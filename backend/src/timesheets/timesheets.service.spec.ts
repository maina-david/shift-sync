import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TimesheetsService } from './timesheets.service';
import { Timesheet, TimesheetStatus } from './entities/timesheet.entity';
import { ShiftAssignment } from '../shifts/entities/shift-assignment.entity';
import { SettingsService } from '../settings/settings.service';
import { User, UserRole } from '../users/entities/user.entity';
import { Location } from '../locations/entities/location.entity';
import { ReviewTimesheetDto } from './dto/review-timesheet.dto';

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

function buildQb(opts: { getMany?: any[] } = {}) {
  return {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(opts.getMany ?? []),
  };
}

const makeManager = (managedLocationIds: string[] = ['loc-1']): User =>
  ({
    id: 'manager-1',
    name: 'Marcus Johnson',
    role: UserRole.MANAGER,
    managedLocations: managedLocationIds.map((id) => ({ id }) as Location),
  }) as User;

const makeAdmin = (): User =>
  ({
    id: 'admin-1',
    name: 'Sarah Chen',
    role: UserRole.ADMIN,
    managedLocations: [],
  }) as unknown as User;

const makeStaff = (): User =>
  ({
    id: 'staff-1',
    name: 'Alice Thompson',
    role: UserRole.STAFF,
  }) as User;

const makeTimesheet = (overrides: Partial<Timesheet> = {}): Timesheet =>
  ({
    id: 'ts-1',
    staffId: 'staff-1',
    locationId: 'loc-1',
    clockIn: new Date('2026-03-20T09:00:00Z'),
    clockOut: new Date('2026-03-20T17:00:00Z'),
    breakMinutes: 0,
    actualHours: 8,
    status: TimesheetStatus.PENDING,
    shiftId: null,
    assignmentId: null,
    ...overrides,
  }) as unknown as Timesheet;

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

describe('TimesheetsService', () => {
  let service: TimesheetsService;
  let repo: jest.Mocked<any>;
  let assignmentRepo: jest.Mocked<any>;
  let settingsService: jest.Mocked<any>;
  let events: jest.Mocked<any>;
  let dataSource: jest.Mocked<any>;

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    assignmentRepo = { findOne: jest.fn() };
    settingsService = {
      getPayroll: jest.fn().mockReturnValue({ overtimeMultiplier: 1.5 }),
    };
    events = { emit: jest.fn() };
    dataSource = { transaction: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimesheetsService,
        { provide: getRepositoryToken(Timesheet), useValue: repo },
        {
          provide: getRepositoryToken(ShiftAssignment),
          useValue: assignmentRepo,
        },
        { provide: SettingsService, useValue: settingsService },
        { provide: EventEmitter2, useValue: events },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<TimesheetsService>(TimesheetsService);
  });

  // ---------------------------------------------------------------------------
  describe('clockIn', () => {
    it('throws BadRequestException if neither assignmentId nor shiftId is provided', async () => {
      await expect(service.clockIn('staff-1', {} as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws ConflictException when staff is already clocked in', async () => {
      const em = {
        findOne: jest.fn().mockResolvedValue(makeTimesheet({ clockOut: null })),
        create: jest.fn(),
        save: jest.fn(),
      };
      dataSource.transaction.mockImplementation((fn: any) => fn(em));
      assignmentRepo.findOne.mockResolvedValue({
        id: 'assign-1',
        shiftId: 'shift-1',
        shift: { locationId: 'loc-1' },
      });

      await expect(
        service.clockIn('staff-1', { assignmentId: 'assign-1' }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates a new PENDING timesheet when no open session exists', async () => {
      const savedTimesheet = makeTimesheet({
        clockOut: null,
        status: TimesheetStatus.PENDING,
      });
      const em = {
        findOne: jest.fn().mockResolvedValue(null), // no open session
        create: jest.fn().mockReturnValue(savedTimesheet),
        save: jest.fn().mockResolvedValue(savedTimesheet),
      };
      dataSource.transaction.mockImplementation((fn: any) => fn(em));
      assignmentRepo.findOne.mockResolvedValue({
        id: 'assign-1',
        shiftId: 'shift-1',
        shift: { locationId: 'loc-1' },
      });

      const result = await service.clockIn('staff-1', {
        assignmentId: 'assign-1',
      });
      expect(em.save).toHaveBeenCalled();
      expect(result.status).toBe(TimesheetStatus.PENDING);
    });
  });

  // ---------------------------------------------------------------------------
  describe('clockOut', () => {
    it('throws NotFoundException if no active clock-in session', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(
        service.clockOut('staff-1', { breakMinutes: 0 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('correctly calculates actualHours subtracting break minutes', async () => {
      const clockIn = new Date('2026-03-20T09:00:00Z');
      const ts = makeTimesheet({ clockIn, clockOut: null });
      repo.findOne.mockResolvedValue(ts);

      // Advance "now" to 17:00 UTC — 8 hours later
      const mockNow = new Date('2026-03-20T17:00:00Z');
      jest
        .spyOn(global, 'Date')
        .mockImplementation(
          (arg?: any) => (arg === undefined ? mockNow : new Date(arg)) as any,
        );

      repo.save.mockImplementation((t: Timesheet) => Promise.resolve(t));
      const result = await service.clockOut('staff-1', { breakMinutes: 30 });

      // 8h elapsed − 0.5h break = 7.5h
      expect(result.actualHours).toBe(7.5);
      jest.restoreAllMocks();
    });
  });

  // ---------------------------------------------------------------------------
  describe('review', () => {
    const dto: ReviewTimesheetDto = { status: TimesheetStatus.APPROVED };

    it('throws NotFoundException when timesheet does not exist', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(
        service.review('ts-missing', dto, makeAdmin()),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when staff is still clocked in', async () => {
      repo.findOne.mockResolvedValue(makeTimesheet({ clockOut: null }));
      await expect(service.review('ts-1', dto, makeAdmin())).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when timesheet is not PENDING', async () => {
      repo.findOne.mockResolvedValue(
        makeTimesheet({ status: TimesheetStatus.APPROVED }),
      );
      await expect(service.review('ts-1', dto, makeAdmin())).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws ForbiddenException when manager does not manage the timesheet location', async () => {
      repo.findOne.mockResolvedValue(
        makeTimesheet({ locationId: 'loc-other' }),
      );
      const manager = makeManager(['loc-1']); // manages loc-1, not loc-other
      await expect(service.review('ts-1', dto, manager)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('succeeds when manager manages the timesheet location', async () => {
      const ts = makeTimesheet({ locationId: 'loc-1' });
      repo.findOne.mockResolvedValue(ts);
      repo.save.mockImplementation((t: any) => Promise.resolve(t));
      const manager = makeManager(['loc-1']);

      const result = await service.review('ts-1', dto, manager);
      expect(result.status).toBe(TimesheetStatus.APPROVED);
      expect(result.reviewedById).toBe(manager.id);
    });

    it('admin bypasses location check', async () => {
      repo.findOne.mockResolvedValue(
        makeTimesheet({ locationId: 'any-location' }),
      );
      repo.save.mockImplementation((t: any) => Promise.resolve(t));
      const result = await service.review('ts-1', dto, makeAdmin());
      expect(result.status).toBe(TimesheetStatus.APPROVED);
    });

    it('emits audit.log after successful review', async () => {
      repo.findOne.mockResolvedValue(makeTimesheet());
      repo.save.mockImplementation((t: any) => Promise.resolve(t));
      await service.review('ts-1', dto, makeAdmin());
      expect(events.emit).toHaveBeenCalledWith(
        'audit.log',
        expect.objectContaining({ entity: 'timesheet', action: 'approved' }),
      );
    });

    it('emits timesheet.reviewed event after save', async () => {
      repo.findOne.mockResolvedValue(makeTimesheet());
      repo.save.mockImplementation((t: any) => Promise.resolve(t));
      await service.review('ts-1', dto, makeAdmin());
      expect(events.emit).toHaveBeenCalledWith(
        'timesheet.reviewed',
        expect.objectContaining({ status: TimesheetStatus.APPROVED }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  describe('findAll', () => {
    it('filters results to allowed location IDs when provided', async () => {
      const qb = buildQb({ getMany: [] });
      repo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ allowedLocationIds: ['loc-1', 'loc-2'] });

      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('allowedLocationIds'),
        expect.objectContaining({ allowedLocationIds: ['loc-1', 'loc-2'] }),
      );
    });

    it('uses __none__ sentinel when allowedLocationIds is an empty array', async () => {
      const qb = buildQb({ getMany: [] });
      repo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ allowedLocationIds: [] });

      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('allowedLocationIds'),
        expect.objectContaining({ allowedLocationIds: ['__none__'] }),
      );
    });

    it('filters by a specific locationId when provided', async () => {
      const qb = buildQb({ getMany: [] });
      repo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ locationId: 'loc-1' });

      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('locationId'),
        expect.objectContaining({ locationId: 'loc-1' }),
      );
    });
  });
});
