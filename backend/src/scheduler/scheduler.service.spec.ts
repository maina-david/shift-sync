import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SchedulerRegistry } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SchedulerService } from './scheduler.service';
import {
  ShiftAssignment,
  AssignmentStatus,
} from '../shifts/entities/shift-assignment.entity';
import { Shift, ShiftStatus } from '../shifts/entities/shift.entity';
import {
  TimeOffRequest,
  TimeOffStatus,
} from '../time-off-requests/entities/time-off-request.entity';
import {
  Reservation,
  ReservationStatus,
} from '../reservations/entities/reservation.entity';
import {
  SwapRequest,
  SwapRequestStatus,
} from '../swap-requests/entities/swap-request.entity';
import { User, UserRole } from '../users/entities/user.entity';
import {
  Notification,
  NotificationType,
} from '../notifications/entities/notification.entity';
import { Certification } from '../certifications/entities/certification.entity';

function buildQb(
  opts: {
    getMany?: any[];
    getManyAndCount?: [any[], number];
    getCount?: number;
    getRawMany?: any[];
    select?: jest.Mock;
  } = {},
) {
  return {
    innerJoin: jest.fn().mockReturnThis(),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    select: opts.select ?? jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected: 5 }),
    getMany: jest.fn().mockResolvedValue(opts.getMany ?? []),
    getManyAndCount: jest
      .fn()
      .mockResolvedValue(opts.getManyAndCount ?? [[], 0]),
    getCount: jest.fn().mockResolvedValue(opts.getCount ?? 0),
    getRawMany: jest.fn().mockResolvedValue(opts.getRawMany ?? []),
  };
}

const makeManager = (): User =>
  ({
    id: 'manager-1',
    role: UserRole.MANAGER,
    isActive: true,
  }) as unknown as User;

describe('SchedulerService', () => {
  beforeAll(() => jest.useFakeTimers());
  afterAll(() => jest.useRealTimers());
  let service: SchedulerService;
  let assignRepo: jest.Mocked<any>;
  let shiftRepo: jest.Mocked<any>;
  let timeOffRepo: jest.Mocked<any>;
  let reservRepo: jest.Mocked<any>;
  let swapRepo: jest.Mocked<any>;
  let userRepo: jest.Mocked<any>;
  let notifRepo: jest.Mocked<any>;
  let certRepo: jest.Mocked<any>;
  let events: jest.Mocked<any>;
  let schedulerRegistry: jest.Mocked<any>;

  beforeEach(async () => {
    assignRepo = { createQueryBuilder: jest.fn(), update: jest.fn() };
    shiftRepo = { createQueryBuilder: jest.fn() };
    timeOffRepo = {
      find: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    };
    reservRepo = {
      createQueryBuilder: jest.fn(),
      update: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    };
    swapRepo = {
      createQueryBuilder: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    };
    userRepo = { createQueryBuilder: jest.fn() };
    notifRepo = { createQueryBuilder: jest.fn() };
    certRepo = { createQueryBuilder: jest.fn() };
    events = { emit: jest.fn() };
    schedulerRegistry = {
      addInterval: jest.fn(),
      deleteInterval: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulerService,
        { provide: getRepositoryToken(ShiftAssignment), useValue: assignRepo },
        { provide: getRepositoryToken(Shift), useValue: shiftRepo },
        { provide: getRepositoryToken(TimeOffRequest), useValue: timeOffRepo },
        { provide: getRepositoryToken(Reservation), useValue: reservRepo },
        { provide: getRepositoryToken(SwapRequest), useValue: swapRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Notification), useValue: notifRepo },
        { provide: getRepositoryToken(Certification), useValue: certRepo },
        { provide: EventEmitter2, useValue: events },
        { provide: SchedulerRegistry, useValue: schedulerRegistry },
      ],
    }).compile();

    service = module.get<SchedulerService>(SchedulerService);
  });

  describe('onModuleInit / onModuleDestroy', () => {
    it('registers the cleanup interval on init', () => {
      service.onModuleInit();
      expect(schedulerRegistry.addInterval).toHaveBeenCalledWith(
        'cleanup-old-notifications',
        expect.any(Object),
      );
    });

    it('deletes the interval on destroy', () => {
      service.onModuleDestroy();
      expect(schedulerRegistry.deleteInterval).toHaveBeenCalledWith(
        'cleanup-old-notifications',
      );
    });
  });

  describe('completePastAssignments', () => {
    it('does nothing when no past assignments exist', async () => {
      assignRepo.createQueryBuilder.mockReturnValue(buildQb({ getMany: [] }));
      await service.completePastAssignments();
      expect(assignRepo.update).not.toHaveBeenCalled();
    });

    it('bulk-updates past ASSIGNED assignments to COMPLETED', async () => {
      assignRepo.createQueryBuilder.mockReturnValue(
        buildQb({ getMany: [{ id: 'a-1' }, { id: 'a-2' }] }),
      );
      assignRepo.update.mockResolvedValue({ affected: 2 });
      await service.completePastAssignments();
      expect(assignRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: expect.anything() }),
        { status: AssignmentStatus.COMPLETED },
      );
    });
  });

  describe('sendDailyShiftReminders', () => {
    it('does nothing when no assignments for today', async () => {
      assignRepo.createQueryBuilder.mockReturnValue(buildQb({ getMany: [] }));
      await service.sendDailyShiftReminders();
      expect(events.emit).not.toHaveBeenCalled();
    });

    it('emits SHIFT_REMINDER notification for each assigned shift', async () => {
      const assignment = {
        staffId: 'staff-1',
        shift: {
          id: 'shift-1',
          location: { name: 'North Beach' },
          startTime: '09:00',
          endTime: '17:00',
          requiredSkill: null,
        },
      };
      assignRepo.createQueryBuilder.mockReturnValue(
        buildQb({ getMany: [assignment] }),
      );

      await service.sendDailyShiftReminders();
      expect(events.emit).toHaveBeenCalledWith(
        'notification.send',
        expect.objectContaining({
          type: NotificationType.SHIFT_REMINDER,
          userId: 'staff-1',
        }),
      );
    });
  });

  describe('remindStalePendingTimeOff', () => {
    it('does nothing when no stale time-off requests', async () => {
      timeOffRepo.find.mockResolvedValue([]);
      await service.remindStalePendingTimeOff();
      expect(events.emit).not.toHaveBeenCalled();
    });

    it('notifies all managers when stale requests exist', async () => {
      timeOffRepo.find.mockResolvedValue([{ id: 'tor-1' }, { id: 'tor-2' }]);
      userRepo.createQueryBuilder.mockReturnValue(
        buildQb({ getMany: [makeManager()] }),
      );

      await service.remindStalePendingTimeOff();
      expect(events.emit).toHaveBeenCalledWith(
        'notification.send',
        expect.objectContaining({ type: NotificationType.TIME_OFF_REMINDER }),
      );
    });
  });

  describe('warnUnpublishedSchedule', () => {
    it('does not warn when next week already has published shifts', async () => {
      shiftRepo.createQueryBuilder.mockReturnValue(buildQb({ getCount: 5 }));
      await service.warnUnpublishedSchedule();
      expect(events.emit).not.toHaveBeenCalled();
    });

    it('warns all managers when no shifts published for next week', async () => {
      shiftRepo.createQueryBuilder.mockReturnValue(buildQb({ getCount: 0 }));
      userRepo.createQueryBuilder.mockReturnValue(
        buildQb({ getMany: [makeManager()] }),
      );

      await service.warnUnpublishedSchedule();
      expect(events.emit).toHaveBeenCalledWith(
        'notification.send',
        expect.objectContaining({
          type: NotificationType.SCHEDULE_UNPUBLISHED_WARNING,
        }),
      );
    });
  });

  describe('markNoShowReservations', () => {
    it('does nothing when no eligible reservations', async () => {
      reservRepo.createQueryBuilder.mockReturnValue(buildQb({ getMany: [] }));
      await service.markNoShowReservations();
      expect(reservRepo.update).not.toHaveBeenCalled();
    });

    it('marks past pending/confirmed reservations as NO_SHOW', async () => {
      reservRepo.createQueryBuilder.mockReturnValue(
        buildQb({ getMany: [{ id: 'res-1' }] }),
      );
      reservRepo.update.mockResolvedValue({ affected: 1 });

      await service.markNoShowReservations();
      expect(reservRepo.update).toHaveBeenCalledWith(expect.any(Object), {
        status: ReservationStatus.NO_SHOW,
      });
    });
  });

  describe('remindUnansweredSwapRequests', () => {
    it('does nothing when no stale swap requests', async () => {
      swapRepo.createQueryBuilder.mockReturnValue(buildQb({ getMany: [] }));
      await service.remindUnansweredSwapRequests();
      expect(events.emit).not.toHaveBeenCalled();
    });

    it('emits SWAP_PENDING_REMINDER for each stale swap', async () => {
      const swap = {
        id: 'swap-1',
        toUserId: 'staff-2',
        fromAssignment: { shift: { date: '2026-03-15' } },
      };
      swapRepo.createQueryBuilder.mockReturnValue(buildQb({ getMany: [swap] }));

      await service.remindUnansweredSwapRequests();
      expect(events.emit).toHaveBeenCalledWith(
        'notification.send',
        expect.objectContaining({
          type: NotificationType.SWAP_PENDING_REMINDER,
          userId: 'staff-2',
        }),
      );
    });
  });

  describe('warnExpiringCertifications', () => {
    it('does nothing when no certs expiring soon', async () => {
      certRepo.createQueryBuilder.mockReturnValue(buildQb({ getMany: [] }));
      await service.warnExpiringCertifications();
      expect(events.emit).not.toHaveBeenCalled();
    });

    it('notifies managers when certs are expiring within 30 days', async () => {
      const cert = {
        id: 'cert-1',
        user: { name: 'Alice' },
        expiryDate: '2026-04-01',
      };
      certRepo.createQueryBuilder.mockReturnValue(buildQb({ getMany: [cert] }));
      userRepo.createQueryBuilder.mockReturnValue(
        buildQb({ getMany: [makeManager()] }),
      );

      await service.warnExpiringCertifications();
      expect(events.emit).toHaveBeenCalledWith(
        'notification.send',
        expect.objectContaining({ type: NotificationType.CERT_EXPIRY_WARNING }),
      );
    });
  });

  describe('cleanupOldReadNotifications', () => {
    it('executes a delete query for old read notifications', async () => {
      const qb = buildQb();
      notifRepo.createQueryBuilder.mockReturnValue(qb);

      await service.cleanupOldReadNotifications();
      expect(qb.delete).toHaveBeenCalled();
      expect(qb.execute).toHaveBeenCalled();
    });
  });
});
