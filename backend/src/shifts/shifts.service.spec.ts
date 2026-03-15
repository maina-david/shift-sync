import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ShiftsService } from './shifts.service';
import { Shift, ShiftStatus } from './entities/shift.entity';
import {
  ShiftAssignment,
  AssignmentStatus,
} from './entities/shift-assignment.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { Availability } from '../users/entities/availability.entity';
import { ConstraintCheckerService } from './constraint-checker.service';
import { UsersService } from '../users/users.service';
import { SettingsService } from '../settings/settings.service';
import { Location } from '../locations/entities/location.entity';
import { DropRequest } from '../drop-requests/entities/drop-request.entity';
import { SwapRequest } from '../swap-requests/entities/swap-request.entity';

function buildQb(
  opts: {
    getMany?: any[];
    getManyAndCount?: [any[], number];
    getCount?: number;
  } = {},
) {
  return {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue([]),
    getMany: jest.fn().mockResolvedValue(opts.getMany ?? []),
    getManyAndCount: jest
      .fn()
      .mockResolvedValue(opts.getManyAndCount ?? [[], 0]),
    getCount: jest.fn().mockResolvedValue(opts.getCount ?? 0),
    getOne: jest.fn().mockResolvedValue(null),
  };
}

const makeLocation = (id = 'loc-1'): Location =>
  ({ id, name: 'North Beach', timezone: 'America/Los_Angeles' }) as Location;

const makeManager = (managedLocationIds: string[] = ['loc-1']): User =>
  ({
    id: 'manager-1',
    name: 'Marcus Johnson',
    role: UserRole.MANAGER,
    managedLocations: managedLocationIds.map((id) => makeLocation(id)),
  }) as unknown as User;

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
    certifiedLocations: [makeLocation()],
    skills: [],
  }) as unknown as User;

const makeShift = (overrides: any = {}): Shift =>
  ({
    id: 'shift-1',
    date: '2099-06-20',
    startTime: '09:00',
    endTime: '17:00',
    locationId: 'loc-1',
    location: makeLocation(),
    status: ShiftStatus.DRAFT,
    headcount: 2,
    assignments: [],
    publishedAt: null,
    publishedById: null,
    ...overrides,
  }) as unknown as Shift;

describe('ShiftsService', () => {
  let service: ShiftsService;
  let shiftRepo: jest.Mocked<any>;
  let assignRepo: jest.Mocked<any>;
  let userRepo: jest.Mocked<any>;
  let availRepo: jest.Mocked<any>;
  let constraints: jest.Mocked<any>;
  let usersService: jest.Mocked<any>;
  let events: jest.Mocked<any>;
  let dataSource: jest.Mocked<any>;
  let settingsService: jest.Mocked<any>;
  let dropRepo: jest.Mocked<any>;
  let swapRepo: jest.Mocked<any>;

  beforeEach(async () => {
    shiftRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      softRemove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    assignRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    userRepo = { findOne: jest.fn(), createQueryBuilder: jest.fn() };
    availRepo = {};
    dropRepo = { find: jest.fn().mockResolvedValue([]), save: jest.fn() };
    swapRepo = { find: jest.fn().mockResolvedValue([]), save: jest.fn() };
    constraints = {
      check: jest
        .fn()
        .mockResolvedValue({ valid: true, violations: [], warnings: [] }),
    };
    usersService = { findQualifiedForShift: jest.fn().mockResolvedValue([]) };
    events = { emit: jest.fn() };
    dataSource = { transaction: jest.fn() };
    settingsService = {
      getScheduling: jest.fn().mockReturnValue({ weeklyOvertimeHours: 40 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShiftsService,
        { provide: getRepositoryToken(Shift), useValue: shiftRepo },
        { provide: getRepositoryToken(ShiftAssignment), useValue: assignRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Availability), useValue: availRepo },
        { provide: getRepositoryToken(DropRequest), useValue: dropRepo },
        { provide: getRepositoryToken(SwapRequest), useValue: swapRepo },
        { provide: ConstraintCheckerService, useValue: constraints },
        { provide: UsersService, useValue: usersService },
        { provide: EventEmitter2, useValue: events },
        { provide: DataSource, useValue: dataSource },
        { provide: SettingsService, useValue: settingsService },
      ],
    }).compile();

    service = module.get<ShiftsService>(ShiftsService);
  });

  describe('create', () => {
    it('throws ForbiddenException when manager does not manage the location', async () => {
      const manager = makeManager(['loc-other']);
      await expect(
        service.create(
          {
            locationId: 'loc-1',
            date: '2099-06-20',
            startTime: '09:00',
            endTime: '17:00',
          } as any,
          manager,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('creates shift and emits schedule.updated on success', async () => {
      const manager = makeManager(['loc-1']);
      const shift = makeShift();
      shiftRepo.create.mockReturnValue(shift);
      shiftRepo.save.mockResolvedValue(shift);
      shiftRepo.findOne.mockResolvedValue(shift);

      await service.create(
        {
          locationId: 'loc-1',
          date: '2099-06-20',
          startTime: '09:00',
          endTime: '17:00',
        } as any,
        manager,
      );
      expect(shiftRepo.save).toHaveBeenCalled();
      expect(events.emit).toHaveBeenCalledWith(
        'schedule.updated',
        expect.any(Object),
      );
    });

    it('admin can create a shift at any location', async () => {
      const admin = makeAdmin();
      const shift = makeShift();
      shiftRepo.create.mockReturnValue(shift);
      shiftRepo.save.mockResolvedValue(shift);
      shiftRepo.findOne.mockResolvedValue(shift);

      await expect(
        service.create(
          {
            locationId: 'loc-1',
            date: '2099-06-20',
            startTime: '09:00',
            endTime: '17:00',
          } as any,
          admin,
        ),
      ).resolves.toBeDefined();
    });
  });

  describe('assignStaff', () => {
    it('throws ForbiddenException when manager does not manage the shift location', async () => {
      const manager = makeManager(['loc-other']);
      shiftRepo.findOne.mockResolvedValue(makeShift());
      await expect(
        service.assignStaff('shift-1', { staffId: 'staff-1' } as any, manager),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when shift is already fully staffed', async () => {
      const manager = makeManager(['loc-1']);
      const shift = makeShift({
        headcount: 1,
        assignments: [
          { staffId: 'staff-1', status: AssignmentStatus.ASSIGNED },
        ],
      });
      shiftRepo.findOne.mockResolvedValue(shift);
      await expect(
        service.assignStaff('shift-1', { staffId: 'staff-2' } as any, manager),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when staff member is already assigned', async () => {
      const manager = makeManager(['loc-1']);
      const shift = makeShift({
        headcount: 2,
        assignments: [
          { staffId: 'staff-1', status: AssignmentStatus.ASSIGNED },
        ],
      });
      shiftRepo.findOne.mockResolvedValue(shift);
      userRepo.findOne.mockResolvedValue(makeStaff());
      await expect(
        service.assignStaff('shift-1', { staffId: 'staff-1' } as any, manager),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when constraint check fails', async () => {
      const manager = makeManager(['loc-1']);
      shiftRepo.findOne.mockResolvedValue(makeShift());
      userRepo.findOne.mockResolvedValue(makeStaff());
      constraints.check.mockResolvedValue({
        valid: false,
        violations: [
          {
            rule: 'location_certification',
            severity: 'error',
            message: 'Not certified',
          },
        ],
        warnings: [],
      });
      await expect(
        service.assignStaff('shift-1', { staffId: 'staff-1' } as any, manager),
      ).rejects.toThrow(BadRequestException);
    });

    it('saves assignment and emits audit.log and notification on success', async () => {
      const manager = makeManager(['loc-1']);
      shiftRepo.findOne.mockResolvedValue(makeShift());
      userRepo.findOne.mockResolvedValue(makeStaff());

      const saved = {
        id: 'assign-new',
        staffId: 'staff-1',
        shiftId: 'shift-1',
      };
      dataSource.transaction.mockImplementation(async (fn: any) => {
        const em = {
          findOne: jest.fn().mockResolvedValue(makeShift()),
          create: jest.fn().mockReturnValue(saved),
          save: jest.fn().mockResolvedValue(saved),
        };
        return fn(em);
      });

      const result = await service.assignStaff(
        'shift-1',
        { staffId: 'staff-1' } as any,
        manager,
      );
      expect(result).toBe(saved);
      expect(events.emit).toHaveBeenCalledWith(
        'audit.log',
        expect.objectContaining({ action: 'assigned' }),
      );
      expect(events.emit).toHaveBeenCalledWith(
        'notification.send',
        expect.objectContaining({ userId: 'staff-1' }),
      );
    });
  });

  describe('publish', () => {
    it('throws ForbiddenException when manager does not manage the shift location', async () => {
      const manager = makeManager(['loc-other']);
      shiftRepo.findOne.mockResolvedValue(makeShift());
      await expect(service.publish('shift-1', manager)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('publishes shift and notifies assigned staff', async () => {
      const manager = makeManager(['loc-1']);
      const shift = makeShift({
        status: ShiftStatus.DRAFT,
        assignments: [
          { staffId: 'staff-1', status: AssignmentStatus.ASSIGNED },
        ],
      });
      shiftRepo.findOne.mockResolvedValue(shift);
      shiftRepo.save.mockResolvedValue({
        ...shift,
        status: ShiftStatus.PUBLISHED,
      });

      await service.publish('shift-1', manager);
      expect(shiftRepo.save).toHaveBeenCalled();
      expect(events.emit).toHaveBeenCalledWith(
        'notification.send',
        expect.objectContaining({ userId: 'staff-1' }),
      );
    });
  });

  describe('unpublish', () => {
    it('throws BadRequestException when shift is not published', async () => {
      const manager = makeManager(['loc-1']);
      shiftRepo.findOne.mockResolvedValue(
        makeShift({ status: ShiftStatus.DRAFT }),
      );
      await expect(service.unpublish('shift-1', manager)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when shift starts within 48h', async () => {
      const manager = makeManager(['loc-1']);
      const soon = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      shiftRepo.findOne.mockResolvedValue(
        makeShift({
          status: ShiftStatus.PUBLISHED,
          date: soon.slice(0, 10),
          startTime: soon.slice(11, 16),
        }),
      );
      await expect(service.unpublish('shift-1', manager)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('copyWeek', () => {
    it('throws BadRequestException when source week has no shifts', async () => {
      const manager = makeManager(['loc-1']);
      shiftRepo.find.mockResolvedValue([]);
      shiftRepo.count.mockResolvedValue(0);
      await expect(
        service.copyWeek('2099-06-16', '2099-06-23', 'loc-1', manager),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when target week already has shifts', async () => {
      const manager = makeManager(['loc-1']);
      shiftRepo.find.mockResolvedValue([makeShift()]);
      shiftRepo.count.mockResolvedValue(1);
      await expect(
        service.copyWeek('2099-06-16', '2099-06-23', 'loc-1', manager),
      ).rejects.toThrow(BadRequestException);
    });

    it('copies shifts and emits schedule.updated', async () => {
      const manager = makeManager(['loc-1']);
      shiftRepo.find.mockResolvedValue([makeShift()]);
      shiftRepo.count.mockResolvedValue(0);
      shiftRepo.create.mockImplementation((data: any) => data);
      shiftRepo.save.mockResolvedValue([makeShift()]);

      const result = await service.copyWeek(
        '2099-06-16',
        '2099-06-23',
        'loc-1',
        manager,
      );
      expect(result.copied).toBe(1);
      expect(events.emit).toHaveBeenCalledWith(
        'schedule.updated',
        expect.any(Object),
      );
    });
  });

  describe('removeAssignment', () => {
    it('throws NotFoundException when assignment does not exist', async () => {
      const manager = makeManager(['loc-1']);
      shiftRepo.findOne.mockResolvedValue(makeShift());
      assignRepo.findOne.mockResolvedValue(null);
      await expect(
        service.removeAssignment('shift-1', 'assign-1', manager),
      ).rejects.toThrow(NotFoundException);
    });

    it('cancels assignment and emits notifications', async () => {
      const manager = makeManager(['loc-1']);
      shiftRepo.findOne.mockResolvedValue(makeShift());
      const assignment = {
        id: 'assign-1',
        staffId: 'staff-1',
        status: AssignmentStatus.ASSIGNED,
      };
      assignRepo.findOne.mockResolvedValue(assignment);
      assignRepo.save.mockResolvedValue({
        ...assignment,
        status: AssignmentStatus.CANCELLED,
      });

      await service.removeAssignment('shift-1', 'assign-1', manager);
      expect(events.emit).toHaveBeenCalledWith(
        'audit.log',
        expect.objectContaining({ action: 'removed' }),
      );
      expect(events.emit).toHaveBeenCalledWith(
        'notification.send',
        expect.objectContaining({ userId: 'staff-1' }),
      );
    });
  });

  describe('remove', () => {
    it('throws ForbiddenException when manager does not manage the shift location', async () => {
      const manager = makeManager(['loc-other']);
      shiftRepo.findOne.mockResolvedValue(makeShift());
      await expect(service.remove('shift-1', manager)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('soft-removes the shift and emits schedule.updated when there are no active assignments', async () => {
      const manager = makeManager(['loc-1']);
      shiftRepo.findOne.mockResolvedValue(makeShift({ assignments: [] }));
      shiftRepo.softRemove.mockResolvedValue(undefined);

      await service.remove('shift-1', manager);
      expect(shiftRepo.softRemove).toHaveBeenCalled();
      expect(events.emit).toHaveBeenCalledWith(
        'schedule.updated',
        expect.objectContaining({ locationId: 'loc-1' }),
      );
    });

    it('cancels active assignments and related open drop requests when shift is deleted', async () => {
      const manager = makeManager(['loc-1']);
      const assignment = {
        id: 'assign-1',
        staffId: 'staff-1',
        status: AssignmentStatus.ASSIGNED,
      };
      shiftRepo.findOne.mockResolvedValue(
        makeShift({ assignments: [assignment] }),
      );
      assignRepo.save.mockResolvedValue({
        ...assignment,
        status: AssignmentStatus.CANCELLED,
      });
      dropRepo.find.mockResolvedValue([
        { id: 'drop-1', assignmentId: 'assign-1', status: 'open' },
      ]);
      dropRepo.save.mockResolvedValue({});
      shiftRepo.softRemove.mockResolvedValue(undefined);

      await service.remove('shift-1', manager);

      expect(assignRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: AssignmentStatus.CANCELLED }),
      );
      expect(dropRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'cancelled' }),
      );
    });

    it('cancels pending swap requests and notifies the swap target when shift is deleted', async () => {
      const manager = makeManager(['loc-1']);
      const assignment = {
        id: 'assign-1',
        staffId: 'staff-1',
        status: AssignmentStatus.ASSIGNED,
      };
      shiftRepo.findOne.mockResolvedValue(
        makeShift({ assignments: [assignment] }),
      );
      assignRepo.save.mockResolvedValue({
        ...assignment,
        status: AssignmentStatus.CANCELLED,
      });
      swapRepo.find.mockResolvedValue([
        {
          id: 'swap-1',
          fromAssignmentId: 'assign-1',
          status: 'pending',
          toUserId: 'staff-2',
        },
      ]);
      swapRepo.save.mockResolvedValue({});
      shiftRepo.softRemove.mockResolvedValue(undefined);

      await service.remove('shift-1', manager);

      expect(swapRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'cancelled' }),
      );
      expect(events.emit).toHaveBeenCalledWith(
        'notification.send',
        expect.objectContaining({
          userId: 'staff-2',
          type: 'SWAP_CANCELLED_SHIFT_EDIT',
        }),
      );
    });

    it('notifies each affected staff member when their shift is deleted', async () => {
      const manager = makeManager(['loc-1']);
      const assignment = {
        id: 'assign-1',
        staffId: 'staff-1',
        status: AssignmentStatus.ASSIGNED,
      };
      shiftRepo.findOne.mockResolvedValue(
        makeShift({ assignments: [assignment] }),
      );
      assignRepo.save.mockResolvedValue({
        ...assignment,
        status: AssignmentStatus.CANCELLED,
      });
      shiftRepo.softRemove.mockResolvedValue(undefined);

      await service.remove('shift-1', manager);

      expect(events.emit).toHaveBeenCalledWith(
        'notification.send',
        expect.objectContaining({ userId: 'staff-1', type: 'SHIFT_CANCELLED' }),
      );
    });
  });

  describe('autoSchedule', () => {
    it('throws ForbiddenException when manager does not manage the target location', async () => {
      const manager = makeManager(['loc-other']);
      await expect(
        service.autoSchedule(
          { locationId: 'loc-1', weekStart: '2099-06-16' } as any,
          manager,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('admin can auto-schedule at any location', async () => {
      const admin = makeAdmin();
      userRepo.createQueryBuilder.mockReturnValue(buildQb({ getMany: [] }));
      dataSource.transaction.mockImplementation(async (fn: any) => {
        return fn({
          create: jest.fn().mockReturnValue({}),
          save: jest.fn().mockResolvedValue({}),
        });
      });

      const result = await service.autoSchedule(
        { locationId: 'loc-1', weekStart: '2099-06-16' } as any,
        admin,
      );
      expect(result).toHaveProperty('shiftsCreated');
    });

    it('manager can auto-schedule at a location they manage', async () => {
      const manager = makeManager(['loc-1']);
      userRepo.createQueryBuilder.mockReturnValue(buildQb({ getMany: [] }));
      dataSource.transaction.mockImplementation(async (fn: any) => {
        return fn({
          create: jest.fn().mockReturnValue({}),
          save: jest.fn().mockResolvedValue({}),
        });
      });

      const result = await service.autoSchedule(
        { locationId: 'loc-1', weekStart: '2099-06-16' } as any,
        manager,
      );
      expect(result).toHaveProperty('shiftsCreated');
    });
  });

  describe('confirmAssignment', () => {
    it("throws ForbiddenException when it is not the staff member's assignment", async () => {
      assignRepo.findOne.mockResolvedValue({
        id: 'assign-1',
        staffId: 'staff-1',
        confirmedAt: null,
      });
      const wrongStaff = makeStaff();
      (wrongStaff as any).id = 'staff-99';
      await expect(
        service.confirmAssignment('shift-1', 'assign-1', wrongStaff),
      ).rejects.toThrow(ForbiddenException);
    });

    it('confirms assignment and returns saved result', async () => {
      const assignment = {
        id: 'assign-1',
        staffId: 'staff-1',
        confirmedAt: null,
      };
      assignRepo.findOne.mockResolvedValue(assignment);
      assignRepo.save.mockImplementation((a: any) => Promise.resolve(a));

      const result = await service.confirmAssignment(
        'shift-1',
        'assign-1',
        makeStaff(),
      );
      expect(result.confirmedAt).toBeDefined();
    });
  });
});
