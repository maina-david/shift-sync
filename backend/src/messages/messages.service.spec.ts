import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MessagesService } from './messages.service';
import { Message, MessageType } from './entities/message.entity';
import { UserRole } from '../users/entities/user.entity';

function buildQb(opts: { getMany?: any[] } = {}) {
  return {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected: 3 }),
    getMany: jest.fn().mockResolvedValue(opts.getMany ?? []),
  };
}

const makeMessage = (overrides: any = {}): Message =>
  ({
    id: 'msg-1',
    type: MessageType.DIRECT,
    senderId: 'user-1',
    recipientId: 'user-2',
    body: 'Hello',
    isRead: false,
    locationId: null,
    createdAt: new Date('2026-03-15T09:00:00Z'),
    ...overrides,
  }) as unknown as Message;

describe('MessagesService', () => {
  let service: MessagesService;
  let repo: jest.Mocked<any>;

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: getRepositoryToken(Message), useValue: repo },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
  });

  describe('send', () => {
    it('throws BadRequestException when direct message has no recipientId', async () => {
      await expect(
        service.send('user-1', UserRole.STAFF, {
          type: MessageType.DIRECT,
          body: 'Hi',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when staff tries to send an announcement', async () => {
      await expect(
        service.send('staff-1', UserRole.STAFF, {
          type: MessageType.ANNOUNCEMENT,
          body: 'Attention!',
          locationId: 'loc-1',
        } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows manager to send announcement', async () => {
      const msg = makeMessage({ type: MessageType.ANNOUNCEMENT });
      repo.create.mockReturnValue(msg);
      repo.save.mockResolvedValue(msg);

      const result = await service.send('manager-1', UserRole.MANAGER, {
        type: MessageType.ANNOUNCEMENT,
        body: 'Heads up',
        locationId: 'loc-1',
      } as any);
      expect(result.type).toBe(MessageType.ANNOUNCEMENT);
    });

    it('creates and saves a direct message', async () => {
      const msg = makeMessage();
      repo.create.mockReturnValue(msg);
      repo.save.mockResolvedValue(msg);

      const result = await service.send('user-1', UserRole.STAFF, {
        type: MessageType.DIRECT,
        recipientId: 'user-2',
        body: 'Hello',
      } as any);
      expect(result.id).toBe('msg-1');
    });
  });

  describe('getDirectThread', () => {
    it('returns messages between two users in order', async () => {
      const qb = buildQb({ getMany: [makeMessage()] });
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getDirectThread('user-1', 'user-2');
      expect(result).toHaveLength(1);
    });
  });

  describe('getAnnouncements', () => {
    it('returns announcements filtered by locationId', async () => {
      const qb = buildQb({
        getMany: [makeMessage({ type: MessageType.ANNOUNCEMENT })],
      });
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getAnnouncements('loc-1');
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('locationId'),
        expect.objectContaining({ locationId: 'loc-1' }),
      );
    });
  });

  describe('getInbox', () => {
    it('deduplicates threads by conversation partner', async () => {
      const messages = [
        makeMessage({
          senderId: 'user-1',
          recipientId: 'user-2',
          createdAt: new Date('2026-03-15T10:00:00Z'),
        }),
        makeMessage({
          id: 'msg-2',
          senderId: 'user-2',
          recipientId: 'user-1',
          createdAt: new Date('2026-03-15T09:00:00Z'),
        }),
      ];
      const qb1 = buildQb({ getMany: messages });
      const qb2 = buildQb({ getMany: [] });
      let calls = 0;
      repo.createQueryBuilder.mockImplementation(() =>
        ++calls <= 1 ? qb1 : qb2,
      );

      const result = await service.getInbox('user-1');
      expect(result.threads).toHaveLength(1);
    });
  });

  describe('markRead', () => {
    it('throws NotFoundException when message does not exist', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.markRead('missing', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when user is not the recipient', async () => {
      repo.findOne.mockResolvedValue(makeMessage({ recipientId: 'user-2' }));
      await expect(service.markRead('msg-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('marks message as read when called by recipient', async () => {
      const msg = makeMessage({ recipientId: 'user-2' });
      repo.findOne.mockResolvedValue(msg);
      repo.save.mockImplementation((m: any) => Promise.resolve(m));

      const result = await service.markRead('msg-1', 'user-2');
      expect(result.isRead).toBe(true);
    });
  });

  describe('markAllRead', () => {
    it('marks all unread direct messages for a user as read', async () => {
      const qb = buildQb();
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.markAllRead('user-1');
      expect(result.updated).toBe(3);
    });
  });
});
