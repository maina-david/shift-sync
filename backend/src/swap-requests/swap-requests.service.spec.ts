import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SwapRequestsService } from './swap-requests.service';
import { SwapRequest, SwapRequestStatus } from './entities/swap-request.entity';
import { ShiftAssignment, AssignmentStatus } from '../shifts/entities/shift-assignment.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { ConstraintCheckerService } from '../shifts/constraint-checker.service';
import { Location } from '../locations/entities/location.entity';
import { NotificationType } from '../notifications/entities/notification.entity';

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

function buildQb(opts: {
  getMany?: any[];
  getManyAndCount?: [any[], number];
} = {}) {
  return {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(opts.getMany ?? []),
    getManyAndCount: jest.fn().mockResolvedValue(opts.getManyAndCount ?? [[], 0]),
  };
}

const makeLocation = (id = 'loc-1'): Location =>
  ({ id, name: 'North Beach', timezone: 'America/Los_Angeles' } as Location);

const makeStaff = (id = 'staff-1'): User =>
  ({
    id,
    name: id === 'staff-1' ? 'Alice Thompson' : 'Bob Martinez',
    role: UserRole.STAFF,
    certifiedLocations: [makeLocation()],
    skills: [],
  } as unknown as User);

const makeManager = (managedLocationIds: string[] = ['loc-1']): User =>
  ({
    id: 'manager-1',
    name: 'Marcus Johnson',
    role: UserRole.MANAGER,
    managedLocations: managedLocationIds.map((id) => makeLocation(id)),
  } as unknown as User);

const makeAssignment = (staffId = 'staff-1'): ShiftAssignment =>
  ({
    id: 'assign-1',
    staffId,
    shiftId: 'shift-1',
    status: AssignmentStatus.ASSIGNED,
    shift: {
      id: 'shift-1',
      date: '2099-12-20',
      startTime: '09:00',
      endTime: '17:00',
      locationId: 'loc-1',
      location: makeLocation(),
    },
    staff: makeStaff(staffId),
  } as unknown as ShiftAssignment);

const makeSwap = (overrides: any = {}): SwapRequest =>
  ({
    id: 'swap-1',
    fromAssignmentId: 'assign-1',
    toUserId: 'staff-2',
    status: SwapRequestStatus.PENDING,
    fromAssignment: makeAssignment('staff-1'),
    toUser: makeStaff('staff-2'),
    managerId: null,
    managerNote: null,
    reviewedAt: null,
    ...overrides,
  } as unknown as SwapRequest);

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

describe('SwapRequestsService', () => {
  let service: SwapRequestsService;
  let swapRepo: jest.Mocked<any>;
  let assignRepo: jest.Mocked<any>;
  let userRepo: jest.Mocked<any>;
  let constraints: jest.Mocked<any>;
  let events: jest.Mocked<any>;
  let dataSource: jest.Mocked<any>;

  beforeEach(async () => {
    swapRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    assignRepo = { findOne: jest.fn(), update: jest.fn() };
    userRepo = { findOne: jest.fn() };
    constraints = { check: jest.fn() };
    events = { emit: jest.fn() };
    dataSource = { transaction: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SwapRequestsService,
        { provide: getRepositoryToken(SwapRequest), useValue: swapRepo },
        { provide: getRepositoryToken(ShiftAssignment), useValue: assignRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: ConstraintCheckerService, useValue: constraints },
        { provide: EventEmitter2, useValue: events },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<SwapRequestsService>(SwapRequestsService);
  });

  // ---------------------------------------------------------------------------
  describe('create', () => {
    it('throws BadRequestException when MAX_PENDING_REQUESTS is reached', async () => {
      swapRepo.count.mockResolvedValue(3);
      await expect(
        service.create({ fromAssignmentId: 'assign-1', toUserId: 'staff-2' }, makeStaff()),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when assignment does not belong to requester', async () => {
      swapRepo.count.mockResolvedValue(0);
      assignRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create({ fromAssignmentId: 'missing', toUserId: 'staff-2' }, makeStaff()),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when the target staff fails constraint check', async () => {
      swapRepo.count.mockResolvedValue(0);
      assignRepo.findOne.mockResolvedValue(makeAssignment());
      userRepo.findOne.mockResolvedValue(makeStaff('staff-2'));
      constraints.check.mockResolvedValue({
        valid: false,
        violations: [{ rule: 'location_certification', severity: 'error', message: 'Not certified' }],
      });

      await expect(
        service.create({ fromAssignmentId: 'assign-1', toUserId: 'staff-2' }, makeStaff()),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates the swap, notifies recipient, and emits audit.log on success', async () => {
      swapRepo.count.mockResolvedValue(0);
      assignRepo.findOne.mockResolvedValue(makeAssignment());
      userRepo.findOne.mockResolvedValue(makeStaff('staff-2'));
      constraints.check.mockResolvedValue({ valid: true, violations: [] });

      const savedSwap = makeSwap();
      dataSource.transaction.mockImplementation(async (fn: any) => {
        const em = {
          create: jest.fn().mockReturnValue(savedSwap),
          save: jest.fn().mockResolvedValue(savedSwap),
        };
        return fn(em);
      });

      const result = await service.create(
        { fromAssignmentId: 'assign-1', toUserId: 'staff-2' },
        makeStaff(),
      );
      expect(result.id).toBe('swap-1');
      expect(events.emit).toHaveBeenCalledWith(
        'notification.send',
        expect.objectContaining({ type: NotificationType.SWAP_REQUEST_RECEIVED }),
      );
      expect(events.emit).toHaveBeenCalledWith('audit.log', expect.objectContaining({ action: 'created' }));
    });
  });

  // ---------------------------------------------------------------------------
  describe('accept', () => {
    it('throws ForbiddenException when the swap is not addressed to the user', async () => {
      swapRepo.findOne.mockResolvedValue(makeSwap({ toUserId: 'staff-2' }));
      const wrongUser = makeStaff('staff-99');
      await expect(service.accept('swap-1', wrongUser)).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when swap is no longer PENDING', async () => {
      swapRepo.findOne.mockResolvedValue(makeSwap({ status: SwapRequestStatus.ACCEPTED }));
      await expect(service.accept('swap-1', makeStaff('staff-2'))).rejects.toThrow(BadRequestException);
    });

    it('updates status to ACCEPTED, notifies both parties, and emits audit.log', async () => {
      const swap = makeSwap({ status: SwapRequestStatus.PENDING });
      swapRepo.findOne.mockResolvedValue(swap);
      swapRepo.save.mockResolvedValue({ ...swap, status: SwapRequestStatus.ACCEPTED });

      const result = await service.accept('swap-1', makeStaff('staff-2'));
      expect(result.status).toBe(SwapRequestStatus.ACCEPTED);
      expect(events.emit).toHaveBeenCalledWith(
        'notification.send',
        expect.objectContaining({ type: NotificationType.SWAP_REQUEST_ACCEPTED }),
      );
      expect(events.emit).toHaveBeenCalledWith(
        'notification.sendToManagers',
        expect.objectContaining({ type: NotificationType.SWAP_REQUEST_RECEIVED }),
      );
      expect(events.emit).toHaveBeenCalledWith(
        'audit.log',
        expect.objectContaining({ entity: 'swap_request', action: 'accepted' }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  describe('reject (by target staff)', () => {
    it('throws ForbiddenException when the swap is not addressed to the user', async () => {
      swapRepo.findOne.mockResolvedValue(makeSwap({ toUserId: 'staff-2' }));
      await expect(service.reject('swap-1', makeStaff('staff-99'))).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when swap is not PENDING', async () => {
      swapRepo.findOne.mockResolvedValue(makeSwap({ status: SwapRequestStatus.CANCELLED }));
      await expect(service.reject('swap-1', makeStaff('staff-2'))).rejects.toThrow(BadRequestException);
    });

    it('updates status to REJECTED, restores assignment, and emits audit.log', async () => {
      const swap = makeSwap({ status: SwapRequestStatus.PENDING });
      swapRepo.findOne.mockResolvedValue(swap);

      const rejectedSwap = { ...swap, status: SwapRequestStatus.REJECTED };
      dataSource.transaction.mockImplementation(async (fn: any) => {
        const em = {
          save: jest.fn().mockResolvedValue(rejectedSwap),
          update: jest.fn(),
        };
        return fn(em);
      });

      const result = await service.reject('swap-1', makeStaff('staff-2'));
      expect(result.status).toBe(SwapRequestStatus.REJECTED);
      expect(events.emit).toHaveBeenCalledWith(
        'notification.send',
        expect.objectContaining({ type: NotificationType.SWAP_REQUEST_REJECTED }),
      );
      expect(events.emit).toHaveBeenCalledWith(
        'audit.log',
        expect.objectContaining({ action: 'rejected' }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  describe('approve (by manager)', () => {
    it('throws BadRequestException when swap has not been accepted by both parties', async () => {
      swapRepo.findOne.mockResolvedValue(makeSwap({ status: SwapRequestStatus.PENDING }));
      await expect(service.approve('swap-1', makeManager(), {})).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when manager does not manage the shift location', async () => {
      const swap = makeSwap({ status: SwapRequestStatus.ACCEPTED });
      swapRepo.findOne.mockResolvedValue(swap);
      const manager = makeManager(['loc-other']); // manages loc-other, shift is at loc-1
      await expect(service.approve('swap-1', manager, {})).rejects.toThrow(ForbiddenException);
    });

    it('reassigns shift, notifies both parties, and emits audit.log on success', async () => {
      const swap = makeSwap({ status: SwapRequestStatus.ACCEPTED });
      swapRepo.findOne.mockResolvedValue(swap);

      const approvedSwap = { ...swap, status: SwapRequestStatus.APPROVED };
      dataSource.transaction.mockImplementation(async (fn: any) => {
        const em = {
          findOne: jest.fn().mockResolvedValue({ ...swap, fromAssignment: makeAssignment() }),
          update: jest.fn(),
          create: jest.fn().mockReturnValue({}),
          save: jest.fn().mockImplementation((entity: any, obj?: any) => Promise.resolve(obj ?? approvedSwap)),
        };
        return fn(em);
      });

      const result = await service.approve('swap-1', makeManager(['loc-1']), { managerNote: 'Approved' });
      expect(result.status).toBe(SwapRequestStatus.APPROVED);
      expect(events.emit).toHaveBeenCalledWith(
        'notification.send',
        expect.objectContaining({ type: NotificationType.SWAP_REQUEST_APPROVED }),
      );
      expect(events.emit).toHaveBeenCalledWith(
        'audit.log',
        expect.objectContaining({ action: 'approved' }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  describe('deny (by manager)', () => {
    it('throws BadRequestException when swap has not been accepted', async () => {
      swapRepo.findOne.mockResolvedValue(makeSwap({ status: SwapRequestStatus.PENDING }));
      await expect(service.deny('swap-1', makeManager(), {})).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when manager does not manage the location', async () => {
      const swap = makeSwap({ status: SwapRequestStatus.ACCEPTED });
      swapRepo.findOne.mockResolvedValue(swap);
      await expect(service.deny('swap-1', makeManager(['loc-other']), {})).rejects.toThrow(ForbiddenException);
    });

    it('denies and notifies both parties', async () => {
      const swap = makeSwap({ status: SwapRequestStatus.ACCEPTED });
      swapRepo.findOne.mockResolvedValue(swap);

      const deniedSwap = { ...swap, status: SwapRequestStatus.DENIED };
      dataSource.transaction.mockImplementation(async (fn: any) => {
        const em = {
          save: jest.fn().mockResolvedValue(deniedSwap),
          update: jest.fn(),
        };
        return fn(em);
      });

      const result = await service.deny('swap-1', makeManager(['loc-1']), { managerNote: 'Coverage needed' });
      expect(result.status).toBe(SwapRequestStatus.DENIED);
      expect(events.emit).toHaveBeenCalledWith(
        'notification.send',
        expect.objectContaining({ type: NotificationType.SWAP_REQUEST_DENIED }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  describe('cancel (by requester)', () => {
    it('throws ForbiddenException when a different user tries to cancel', async () => {
      swapRepo.findOne.mockResolvedValue(makeSwap({ fromAssignment: makeAssignment('staff-1') }));
      await expect(service.cancel('swap-1', makeStaff('staff-99'))).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when swap is not PENDING or ACCEPTED', async () => {
      swapRepo.findOne.mockResolvedValue(makeSwap({ status: SwapRequestStatus.APPROVED }));
      await expect(service.cancel('swap-1', makeStaff('staff-1'))).rejects.toThrow(BadRequestException);
    });

    it('cancels and restores assignment status', async () => {
      const swap = makeSwap({ status: SwapRequestStatus.PENDING });
      swapRepo.findOne.mockResolvedValue(swap);

      const cancelledSwap = { ...swap, status: SwapRequestStatus.CANCELLED };
      dataSource.transaction.mockImplementation(async (fn: any) => {
        const em = {
          save: jest.fn().mockResolvedValue(cancelledSwap),
          update: jest.fn(),
        };
        return fn(em);
      });

      const result = await service.cancel('swap-1', makeStaff('staff-1'));
      expect(result.status).toBe(SwapRequestStatus.CANCELLED);
      expect(events.emit).toHaveBeenCalledWith(
        'notification.send',
        expect.objectContaining({ userId: 'staff-2' }),
      );
    });
  });
});
