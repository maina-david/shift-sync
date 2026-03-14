import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message, MessageType } from './entities/message.entity';
import { SendMessageDto } from './dto/send-message.dto';
import { UserRole } from '../users/entities/user.entity';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private repo: Repository<Message>,
  ) {}

  async send(
    senderId: string,
    senderRole: UserRole,
    dto: SendMessageDto,
  ): Promise<Message> {
    if (dto.type === MessageType.DIRECT) {
      if (!dto.recipientId) {
        throw new BadRequestException(
          'recipientId is required for direct messages',
        );
      }
    }

    if (dto.type === MessageType.ANNOUNCEMENT) {
      if (
        senderRole !== UserRole.ADMIN &&
        senderRole !== UserRole.MANAGER
      ) {
        throw new ForbiddenException(
          'Only admins and managers can send announcements',
        );
      }
    }

    const message = this.repo.create({
      type: dto.type,
      senderId,
      recipientId: dto.recipientId ?? null,
      locationId: dto.locationId ?? null,
      body: dto.body,
      isRead: false,
    });

    return this.repo.save(message);
  }

  getDirectThread(userA: string, userB: string): Promise<Message[]> {
    return this.repo
      .createQueryBuilder('msg')
      .where('msg.type = :type', { type: MessageType.DIRECT })
      .andWhere(
        '(msg.senderId = :a AND msg.recipientId = :b) OR (msg.senderId = :b AND msg.recipientId = :a)',
        { a: userA, b: userB },
      )
      .orderBy('msg.createdAt', 'ASC')
      .getMany();
  }

  getAnnouncements(locationId?: string): Promise<Message[]> {
    const qb = this.repo
      .createQueryBuilder('msg')
      .where('msg.type = :type', { type: MessageType.ANNOUNCEMENT });

    if (locationId) {
      qb.andWhere(
        '(msg.locationId = :locationId OR msg.locationId IS NULL)',
        { locationId },
      );
    }

    return qb.orderBy('msg.createdAt', 'DESC').getMany();
  }

  async getInbox(userId: string, userLocationId?: string): Promise<{
    threads: Message[];
    announcements: Message[];
  }> {
    // For each direct thread, get the latest message involving this user
    const threads = await this.repo
      .createQueryBuilder('msg')
      .where('msg.type = :type', { type: MessageType.DIRECT })
      .andWhere(
        '(msg.senderId = :userId OR msg.recipientId = :userId)',
        { userId },
      )
      .orderBy('msg.createdAt', 'DESC')
      .getMany();

    // Deduplicate to one message per thread (latest per conversation partner)
    const seenPartners = new Set<string>();
    const latestPerThread: Message[] = [];
    for (const msg of threads) {
      const partner =
        msg.senderId === userId ? msg.recipientId : msg.senderId;
      if (partner && !seenPartners.has(partner)) {
        seenPartners.add(partner);
        latestPerThread.push(msg);
      }
    }

    // Announcements relevant to user's location (or global)
    const announcementsQb = this.repo
      .createQueryBuilder('msg')
      .where('msg.type = :type', { type: MessageType.ANNOUNCEMENT });

    if (userLocationId) {
      announcementsQb.andWhere(
        '(msg.locationId = :locationId OR msg.locationId IS NULL)',
        { locationId: userLocationId },
      );
    } else {
      announcementsQb.andWhere('msg.locationId IS NULL');
    }

    const announcements = await announcementsQb
      .orderBy('msg.createdAt', 'DESC')
      .limit(20)
      .getMany();

    return { threads: latestPerThread, announcements };
  }

  async markRead(id: string, userId: string): Promise<Message> {
    const msg = await this.repo.findOne({ where: { id } });
    if (!msg) throw new NotFoundException('Message not found');

    if (msg.recipientId !== userId) {
      throw new ForbiddenException(
        'You can only mark messages addressed to you as read',
      );
    }

    msg.isRead = true;
    return this.repo.save(msg);
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await this.repo
      .createQueryBuilder()
      .update(Message)
      .set({ isRead: true })
      .where('recipientId = :userId', { userId })
      .andWhere('isRead = :isRead', { isRead: false })
      .andWhere('type = :type', { type: MessageType.DIRECT })
      .execute();

    return { updated: result.affected ?? 0 };
  }
}
