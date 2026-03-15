import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { Notification } from './entities/notification.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { NotificationsGateway } from './notifications.gateway';
import { EmailService } from '../email/email.service';

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-1',
    email: 'alice@example.com',
    name: 'Alice Thompson',
    role: UserRole.STAFF,
    notificationPreferences: { inApp: true, email: false },
    ...overrides,
  }) as unknown as User;

const makeNotif = () =>
  ({
    id: 'notif-1',
    userId: 'user-1',
    type: 'TEST',
    title: 'Test',
    message: 'Hello',
    isRead: false,
    entityType: null,
    entityId: null,
  }) as unknown as Notification;

describe('NotificationsService', () => {
  let service: NotificationsService;
  let notifRepo: jest.Mocked<any>;
  let userRepo: jest.Mocked<any>;
  let gateway: jest.Mocked<any>;
  let email: jest.Mocked<any>;

  beforeEach(async () => {
    notifRepo = {
      findAndCount: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    userRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    gateway = { emitToUser: jest.fn() };
    email = { sendNotification: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: getRepositoryToken(Notification), useValue: notifRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: NotificationsGateway, useValue: gateway },
        { provide: EmailService, useValue: email },
      ],
    })
      .setLogger({
        log: () => {},
        error: () => {},
        warn: () => {},
        debug: () => {},
        verbose: () => {},
        fatal: () => {},
      })
      .compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  describe('findAll', () => {
    it('returns paginated notifications for a user', async () => {
      notifRepo.findAndCount.mockResolvedValue([[makeNotif()], 1]);
      const result = await service.findAll('user-1', 10, 0);
      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
    });

    it('caps limit at 100', async () => {
      notifRepo.findAndCount.mockResolvedValue([[], 0]);
      await service.findAll('user-1', 9999, 0);
      expect(notifRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });
  });

  describe('markRead', () => {
    it('updates the specific notification to isRead = true', async () => {
      notifRepo.update.mockResolvedValue({ affected: 1 });
      const result = await service.markRead('notif-1', 'user-1');
      expect(notifRepo.update).toHaveBeenCalledWith(
        { id: 'notif-1', userId: 'user-1' },
        { isRead: true },
      );
      expect(result.success).toBe(true);
    });
  });

  describe('markAllRead', () => {
    it('marks all unread notifications for a user as read', async () => {
      notifRepo.update.mockResolvedValue({ affected: 5 });
      const result = await service.markAllRead('user-1');
      expect(notifRepo.update).toHaveBeenCalledWith(
        { userId: 'user-1', isRead: false },
        { isRead: true },
      );
      expect(result.success).toBe(true);
    });
  });

  describe('getUnreadCount', () => {
    it('returns the count of unread notifications', async () => {
      notifRepo.count.mockResolvedValue(3);
      const result = await service.getUnreadCount('user-1');
      expect(result.count).toBe(3);
    });
  });

  describe('handleSendNotification', () => {
    const payload = {
      userId: 'user-1',
      type: 'TEST',
      title: 'Hello',
      message: 'World',
    };

    it('does nothing when user is not found', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await service.handleSendNotification(payload);
      expect(notifRepo.save).not.toHaveBeenCalled();
    });

    it('saves in-app notification and emits to gateway when inApp preference is true', async () => {
      userRepo.findOne.mockResolvedValue(
        makeUser({ notificationPreferences: { inApp: true, email: false } }),
      );
      const saved = makeNotif();
      notifRepo.create.mockReturnValue(saved);
      notifRepo.save.mockResolvedValue(saved);

      await service.handleSendNotification(payload);
      expect(notifRepo.save).toHaveBeenCalled();
      expect(gateway.emitToUser).toHaveBeenCalledWith(
        'user-1',
        'notification',
        saved,
      );
    });

    it('skips in-app notification when inApp preference is false', async () => {
      userRepo.findOne.mockResolvedValue(
        makeUser({ notificationPreferences: { inApp: false, email: false } }),
      );
      await service.handleSendNotification(payload);
      expect(notifRepo.save).not.toHaveBeenCalled();
    });

    it('sends email when email preference is true', async () => {
      userRepo.findOne.mockResolvedValue(
        makeUser({ notificationPreferences: { inApp: false, email: true } }),
      );
      await service.handleSendNotification(payload);
      expect(email.sendNotification).toHaveBeenCalledWith(
        'alice@example.com',
        'Hello',
        'World',
      );
    });

    it('suppresses email errors without throwing', async () => {
      userRepo.findOne.mockResolvedValue(
        makeUser({ notificationPreferences: { inApp: false, email: true } }),
      );
      email.sendNotification.mockRejectedValue(new Error('SMTP failure'));
      await expect(
        service.handleSendNotification(payload),
      ).resolves.not.toThrow();
    });
  });

  describe('handleSendToManagers', () => {
    it('sends notifications to all managers at the given location', async () => {
      const manager1 = makeUser({
        id: 'manager-1',
        role: UserRole.MANAGER,
        notificationPreferences: { inApp: true, email: false },
      });
      const manager2 = makeUser({
        id: 'manager-2',
        role: UserRole.MANAGER,
        notificationPreferences: { inApp: true, email: false },
      });
      const qb = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([manager1, manager2]),
      };
      userRepo.createQueryBuilder.mockReturnValue(qb);
      userRepo.findOne
        .mockResolvedValueOnce(manager1)
        .mockResolvedValueOnce(manager2);
      notifRepo.create.mockReturnValue(makeNotif());
      notifRepo.save.mockResolvedValue(makeNotif());

      await service.handleSendToManagers({
        locationId: 'loc-1',
        type: 'TEST',
        title: 'Hello',
        message: 'World',
      });

      expect(notifRepo.save).toHaveBeenCalledTimes(2);
    });
  });

  describe('handleSendToAdmins', () => {
    it('sends notifications to all admins', async () => {
      const admin = makeUser({
        id: 'admin-1',
        role: UserRole.ADMIN,
        notificationPreferences: { inApp: true, email: false },
      });
      userRepo.find.mockResolvedValue([admin]);
      userRepo.findOne.mockResolvedValue(admin);
      notifRepo.create.mockReturnValue(makeNotif());
      notifRepo.save.mockResolvedValue(makeNotif());

      await service.handleSendToAdmins({
        type: 'TEST',
        title: 'Hello',
        message: 'World',
      });
      expect(notifRepo.save).toHaveBeenCalledTimes(1);
    });
  });
});
