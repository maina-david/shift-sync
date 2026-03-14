import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../users/entities/user.entity';

@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true },
  namespace: '/ws',
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  /** Map of userId → Set of socket IDs */
  private userSockets = new Map<string, Set<string>>();
  /** Map of socketId → userId */
  private socketUser = new Map<string, string>();

  constructor(
    private jwtService: JwtService,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers.authorization?.replace('Bearer ', '');

      const payload = this.jwtService.verify<{ sub: string }>(token);
      const user = await this.userRepo.findOne({
        where: { id: payload.sub },
        relations: ['managedLocations'],
      });

      if (!user) {
        client.disconnect();
        return;
      }

      const sockets = this.userSockets.get(user.id) ?? new Set();
      sockets.add(client.id);
      this.userSockets.set(user.id, sockets);
      this.socketUser.set(client.id, user.id);

      await client.join(`user:${user.id}`);

      if (user.role === UserRole.MANAGER || user.role === UserRole.ADMIN) {
        for (const loc of user.managedLocations ?? []) {
          await client.join(`location:${loc.id}`);
        }
      }
      if (user.role === UserRole.ADMIN) {
        await client.join('admin');
      }
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = this.socketUser.get(client.id);
    if (userId) {
      const sockets = this.userSockets.get(userId);
      sockets?.delete(client.id);
      if (sockets?.size === 0) this.userSockets.delete(userId);
    }
    this.socketUser.delete(client.id);
  }

  @SubscribeMessage('join_location')
  async handleJoinLocation(@ConnectedSocket() client: Socket, @MessageBody() locationId: string) {
    const userId = this.socketUser.get(client.id);
    if (!userId) return;

    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['managedLocations', 'certifiedLocations'],
    });
    if (!user) return;

    const hasAccess =
      user.role === UserRole.ADMIN ||
      user.managedLocations?.some((l) => l.id === locationId) ||
      user.certifiedLocations?.some((l) => l.id === locationId);

    if (hasAccess) {
      await client.join(`location:${locationId}`);
    }
  }

  /** Emit notification to a specific user */
  emitToUser(userId: string, event: string, data: unknown) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  /** Emit to all managers of a location */
  emitToLocation(locationId: string, event: string, data: unknown) {
    this.server.to(`location:${locationId}`).emit(event, data);
  }

  /** Emit schedule update to location room (for real-time calendar refresh) */
  @OnEvent('schedule.updated')
  handleScheduleUpdated(payload: { locationId?: string; shiftId?: string; weekStart?: string }) {
    if (payload.locationId) {
      this.server.to(`location:${payload.locationId}`).emit('schedule:updated', payload);
      this.server.to('admin').emit('schedule:updated', payload);
    }
  }

  /** Real-time conflict detection: emit when simultaneous assignment attempted */
  emitConflict(locationId: string, data: { shiftId: string; staffId: string; message: string }) {
    this.server.to(`location:${locationId}`).emit('assignment:conflict', data);
  }

  @OnEvent('assignment.conflict')
  handleAssignmentConflict(payload: { locationId: string; shiftId: string; staffId: string; message: string }) {
    this.emitConflict(payload.locationId, {
      shiftId: payload.shiftId,
      staffId: payload.staffId,
      message: payload.message,
    });
  }
}
