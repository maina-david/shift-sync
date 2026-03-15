import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { Notification } from './entities/notification.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { NotificationsGateway } from './notifications.gateway';
import { EmailService } from '../email/email.service';

export interface NotificationPayload {
  userId: string;
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
}

export interface LocationNotificationPayload extends Omit<
  NotificationPayload,
  'userId'
> {
  locationId: string;
}

export type BroadcastNotificationPayload = Omit<NotificationPayload, 'userId'>;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification) private notifRepo: Repository<Notification>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private gateway: NotificationsGateway,
    private email: EmailService,
  ) {}

  async findAll(userId: string, limit = 50, offset = 0) {
    const take = Math.min(limit, 100);
    const [items, total] = await this.notifRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      take,
      skip: offset,
    });
    return { items, total, limit: take, offset };
  }

  async markRead(notifId: string, userId: string) {
    await this.notifRepo.update({ id: notifId, userId }, { isRead: true });
    return { success: true };
  }

  async markAllRead(userId: string) {
    await this.notifRepo.update({ userId, isRead: false }, { isRead: true });
    return { success: true };
  }

  async getUnreadCount(userId: string) {
    const count = await this.notifRepo.count({
      where: { userId, isRead: false },
    });
    return { count };
  }

  @OnEvent('notification.send')
  async handleSendNotification(payload: NotificationPayload) {
    const user = await this.userRepo.findOne({ where: { id: payload.userId } });
    if (!user) return;

    if (user.notificationPreferences?.inApp !== false) {
      const notif = this.notifRepo.create({
        userId: payload.userId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        entityType: payload.entityType ?? null,
        entityId: payload.entityId ?? null,
      });
      const saved = await this.notifRepo.save(notif);
      this.gateway.emitToUser(payload.userId, 'notification', saved);
    }

    if (user.notificationPreferences?.email) {
      try {
        await this.email.sendNotification(
          user.email,
          payload.title,
          payload.message,
        );
      } catch (err) {
        this.logger.error(
          `Email notification failed for user ${payload.userId}: ${(err as Error).message}`,
        );
      }
    }
  }

  @OnEvent('notification.sendToManagers')
  async handleSendToManagers(payload: LocationNotificationPayload) {
    const managers = await this.userRepo
      .createQueryBuilder('u')
      .innerJoin('u.managedLocations', 'ml', 'ml.id = :locId', {
        locId: payload.locationId,
      })
      .where('u.role IN (:...roles)', {
        roles: [UserRole.MANAGER, UserRole.ADMIN],
      })
      .getMany();

    await Promise.all(
      managers.map((manager) =>
        this.handleSendNotification({ ...payload, userId: manager.id }),
      ),
    );
  }

  @OnEvent('notification.sendToAdmins')
  async handleSendToAdmins(payload: BroadcastNotificationPayload) {
    const admins = await this.userRepo.find({
      where: { role: UserRole.ADMIN, isActive: true },
    });
    await Promise.all(
      admins.map((admin) =>
        this.handleSendNotification({ ...payload, userId: admin.id }),
      ),
    );
  }
}
