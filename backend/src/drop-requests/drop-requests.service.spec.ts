import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DropRequestsService } from './drop-requests.service';
import { DropRequest, DropRequestStatus } from './entities/drop-request.entity';
import { ShiftAssignment, AssignmentStatus } from '../shifts/entities/shift-assignment.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { ConstraintCheckerService } from '../shifts/constraint-checker.service';
import { Location } from '../locations/entities/location.entity';
import { NotificationType } from '../notifications/entities/notification.entity';

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

const LOC_TZ = 'America/Los_Angeles';

// A shift that starts well in the future (>24h from "now" in tests)
const makeFutureAssignment = (overrides: any = {}): ShiftAssignment =>
  ({
    id: 'assign-1',
    staffId: 'staff-1',
    shiftId: 'shift-1',
    status: AssignmentStatus.ASSIGNED,
    staff: { id: 'staff-1', name: 'Alice Thompson' },
    shift: {
      id: 'shift-1',
      date: '2099-12-20',
      startTime: '09:00',
      endTime: '17:00',
      locationId: 'loc-1',
      location: { id: 'loc-1', name: 'North Beach', timezone: LOC_TZ } as Location,
    },
    ...overrides,
  } as unknown as ShiftAssignment);

const makeDropRequest = (overrides: any = {}): DropRequest =>
  ({
    id: 'drop-1',
    assignmentId: 'assign-1',
    status: DropRequestStatus.OPEN,
    claimedById: null,
    expiresAt: new Date('2099-12-19T09:00:00Z'), // well in the future
    assignment: makeFutureAssignment(),
    ...overrides,
  } as unknown as DropRequest);

const makeStaff = (overrides: Partial<User> = {}): User =>
  ({
    id: 'staff-1',
    name: 'Alice Thompson',
    role: UserRole.STAFF,
    certifiedLocations: [{ id: 'loc-1' } as Location],
    skills: [],
    ...overrides,
  } as unknown as User);

const makeManager = (managedLocationIds: string[] = ['loc-1']): User =>
  ({
    id: 'manager-1',
    name: 'Marcus Johnson',
    role: UserRole.MANAGER,
    managedLocations: managedLocationIds.map((id) => ({ id } as Location)),
  } as unknown as User);

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

describe('DropRequestsService', () => {
  let service: DropRequestsService;
  let dropRepo: jest.Mocked<any>;
  let assignRepo: jest.Mocked<any>;
  let userRepo: jest.Mocked<any>;
  let constraints: jest.Mocked<any>;
  let events: jest.Mocked<any>;
  let dataSource: jest.Mocked<any>;

  beforeEach(async () => {
    dropRepo = { findOne: jest.fn(), save: jest.fn(), count: jest.fn(), create: jest.fn() };
    assignRepo = { findOne: jest.fn(), update: jest.fn() };
    userRepo = { findOne: jest.fn() };
    constraints = { check: jest.fn() };
    events = { emit: jest.fn() };
    dataSource = { transaction: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DropRequestsService,
        { provide: getRepositoryToken(DropRequest), useValue: dropRepo },
        { provide: getRepositoryToken(ShiftAssignment), useValue: assignRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: ConstraintCheckerService, useValue: constraints },
        { provide: EventEmitter2, useValue: events },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<DropRequestsService>(DropRequestsService);
  });

  // ---------------------------------------------------------------------------
  describe('create', () => {
    it('throws BadRequestException when MAX_PENDING_REQUESTS is reached', async () => {
      dropRepo.count.mockResolvedValue(3); // already at the limit
      await expect(
        service.create({ assignmentId: 'assign-1' }, makeStaff()),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when assignment does not belong to requester', async () => {
      dropRepo.count.mockResolvedValue(0);
      assignRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create({ assignmentId: 'missing' }, makeStaff()),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when shift starts within 24 hours', async () => {
      dropRepo.count.mockResolvedValue(0);
      // Shift starting in 1 hour
      const soon = new Date(Date.now() + 60 * 60 * 1000);
      const soonDate = soon.toISOString().slice(0, 10);
      const soonTime = `${String(soon.getUTCHours()).padStart(2, '0')}:${String(soon.getUTCMinutes()).padStart(2, '0')}`;

      assignRepo.findOne.mockResolvedValue(
        makeFutureAssignment({
          shift: {
            id: 'shift-soon',
            date: soonDate,
            startTime: soonTime,
            endTime: '23:59',
            locationId: 'loc-1',
            location: { id: 'loc-1', name: 'North Beach', timezone: 'UTC' },
          },
        }),
      );

      await expect(
        service.create({ assignmentId: 'assign-1' }, makeStaff()),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates the drop request and emits notifications when valid', async () => {
      dropRepo.count.mockResolvedValue(0);
      const assignment = makeFutureAssignment();
      assignRepo.findOne.mockResolvedValue(assignment);

      const saved = makeDropRequest();
      dropRepo.create.mockReturnValue(saved);
      dropRepo.save.mockResolvedValue(saved);

      const result = await service.create({ assignmentId: 'assign-1' }, makeStaff());
      expect(result.id).toBe('drop-1');
      expect(events.emit).toHaveBeenCalledWith(
        'notification.sendToManagers',
        expect.objectContaining({ type: NotificationType.DROP_REQUEST_CREATED }),
      );
      expect(events.emit).toHaveBeenCalledWith('audit.log', expect.objectContaining({ action: 'created' }));
    });
  });

  // ---------------------------------------------------------------------------
  describe('claim', () => {
    it('throws BadRequestException when claimer tries to claim their own shift', async () => {
      // The drop request's assignment.staffId matches the claimer
      const drop = makeDropRequest();
      dropRepo.findOne.mockResolvedValue(drop);

      const claimer = makeStaff({ id: 'staff-1' }); // same as assignment.staffId
      await expect(service.claim('drop-1', claimer)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when drop request is not OPEN (race condition)', async () => {
      const drop = makeDropRequest();
      dropRepo.findOne.mockResolvedValue(drop);

      const claimer = makeStaff({ id: 'claimer-2' });
      userRepo.findOne.mockResolvedValue(claimer);
      constraints.check.mockResolvedValue({ valid: true, violations: [] });

      // Pessimistic lock reveals the request was already claimed
      const alreadyClaimed = makeDropRequest({ status: DropRequestStatus.CLAIMED });
      dataSource.transaction.mockImplementation(async (fn: any) => {
        const em = { findOne: jest.fn().mockResolvedValue(alreadyClaimed), save: jest.fn() };
        return fn(em);
      });

      await expect(service.claim('drop-1', claimer)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when constraint check fails', async () => {
      const drop = makeDropRequest();
      dropRepo.findOne.mockResolvedValue(drop);

      const claimer = makeStaff({ id: 'claimer-2' });
      userRepo.findOne.mockResolvedValue(claimer);
      constraints.check.mockResolvedValue({
        valid: false,
        violations: [{ rule: 'location_certification', severity: 'error', message: 'Not certified' }],
      });

      await expect(service.claim('drop-1', claimer)).rejects.toThrow(BadRequestException);
    });

    it('marks request as CLAIMED and emits notifications on success', async () => {
      const drop = makeDropRequest();
      dropRepo.findOne.mockResolvedValue(drop);

      const claimer = makeStaff({ id: 'claimer-2' });
      userRepo.findOne.mockResolvedValue(claimer);
      constraints.check.mockResolvedValue({ valid: true, violations: [] });

      const claimedDrop = makeDropRequest({ status: DropRequestStatus.CLAIMED, claimedById: 'claimer-2' });
      dataSource.transaction.mockImplementation(async (fn: any) => {
        const em = {
          findOne: jest.fn().mockResolvedValue(makeDropRequest()), // still OPEN in lock
          save: jest.fn().mockResolvedValue(claimedDrop),
        };
        return fn(em);
      });

      const result = await service.claim('drop-1', claimer);
      expect(result.status).toBe(DropRequestStatus.CLAIMED);
      expect(events.emit).toHaveBeenCalledWith(
        'notification.sendToManagers',
        expect.objectContaining({ type: NotificationType.DROP_REQUEST_CLAIMED }),
      );
      expect(events.emit).toHaveBeenCalledWith('audit.log', expect.objectContaining({ action: 'claimed' }));
    });
  });

  // ---------------------------------------------------------------------------
  describe('approve', () => {
    it('throws BadRequestException when drop is not in CLAIMED state', async () => {
      const drop = makeDropRequest({ status: DropRequestStatus.OPEN, claimedById: null });
      dropRepo.findOne.mockResolvedValue(drop);
      await expect(service.approve('drop-1', makeManager(), {})).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when manager does not manage the shift location', async () => {
      const drop = makeDropRequest({ status: DropRequestStatus.CLAIMED, claimedById: 'claimer-2' });
      dropRepo.findOne.mockResolvedValue(drop);
      userRepo.findOne.mockResolvedValue({
        id: 'manager-1',
        managedLocations: [{ id: 'loc-other' }], // Manages loc-other, not loc-1
      });

      await expect(service.approve('drop-1', makeManager(['loc-1']), {})).rejects.toThrow(ForbiddenException);
    });

    it('reassigns shift and emits notifications on successful approval', async () => {
      const drop = makeDropRequest({ status: DropRequestStatus.CLAIMED, claimedById: 'claimer-2' });
      dropRepo.findOne.mockResolvedValue(drop);
      userRepo.findOne.mockResolvedValue({
        id: 'manager-1',
        managedLocations: [{ id: 'loc-1' }],
      });

      const approvedDrop = makeDropRequest({ status: DropRequestStatus.APPROVED });
      dataSource.transaction.mockImplementation(async (fn: any) => {
        const em = {
          findOne: jest.fn().mockResolvedValue(makeDropRequest({ status: DropRequestStatus.CLAIMED, claimedById: 'claimer-2', assignment: makeFutureAssignment() })),
          update: jest.fn(),
          create: jest.fn().mockReturnValue({}),
          save: jest.fn().mockImplementation((entity: any, obj?: any) => Promise.resolve(obj ?? approvedDrop)),
        };
        return fn(em);
      });

      const result = await service.approve('drop-1', makeManager(['loc-1']), {});
      expect(result.status).toBe(DropRequestStatus.APPROVED);
      expect(events.emit).toHaveBeenCalledWith(
        'notification.send',
        expect.objectContaining({ type: NotificationType.DROP_REQUEST_APPROVED }),
      );
      expect(events.emit).toHaveBeenCalledWith('audit.log', expect.objectContaining({ action: 'approved' }));
    });
  });

  // ---------------------------------------------------------------------------
  describe('reject', () => {
    it('throws BadRequestException when drop is already approved or expired', async () => {
      const drop = makeDropRequest({ status: DropRequestStatus.APPROVED });
      dropRepo.findOne.mockResolvedValue(drop);
      await expect(service.reject('drop-1', makeManager(), {})).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when manager does not manage the location', async () => {
      const drop = makeDropRequest({ status: DropRequestStatus.CLAIMED, claimedById: 'claimer-2' });
      dropRepo.findOne.mockResolvedValue(drop);
      userRepo.findOne.mockResolvedValue({
        id: 'manager-1',
        managedLocations: [{ id: 'loc-other' }],
      });

      await expect(service.reject('drop-1', makeManager(['loc-other']), {})).rejects.toThrow(ForbiddenException);
    });

    it('rejects an OPEN drop request and emits audit.log', async () => {
      const drop = makeDropRequest({ status: DropRequestStatus.OPEN });
      dropRepo.findOne.mockResolvedValue(drop);
      userRepo.findOne.mockResolvedValue({ id: 'manager-1', managedLocations: [{ id: 'loc-1' }] });

      const rejectedDrop = makeDropRequest({ status: DropRequestStatus.REJECTED });
      dataSource.transaction.mockImplementation(async (fn: any) => {
        const em = {
          save: jest.fn().mockResolvedValue(rejectedDrop),
          update: jest.fn(),
        };
        return fn(em);
      });

      const result = await service.reject('drop-1', makeManager(['loc-1']), { managerNote: 'Denied' });
      expect(result.status).toBe(DropRequestStatus.REJECTED);
      expect(events.emit).toHaveBeenCalledWith(
        'notification.send',
        expect.objectContaining({ type: NotificationType.DROP_REQUEST_REJECTED }),
      );
      expect(events.emit).toHaveBeenCalledWith('audit.log', expect.objectContaining({ action: 'rejected' }));
    });
  });

  // ---------------------------------------------------------------------------
  describe('cancel', () => {
    it('throws ForbiddenException when a different user tries to cancel', async () => {
      const drop = makeDropRequest({ status: DropRequestStatus.OPEN });
      dropRepo.findOne.mockResolvedValue(drop);

      const otherUser = makeStaff({ id: 'staff-99' });
      await expect(service.cancel('drop-1', otherUser)).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when drop is not OPEN', async () => {
      const drop = makeDropRequest({ status: DropRequestStatus.CLAIMED });
      dropRepo.findOne.mockResolvedValue(drop);
      await expect(service.cancel('drop-1', makeStaff())).rejects.toThrow(BadRequestException);
    });

    it('cancels and restores the assignment', async () => {
      const drop = makeDropRequest({ status: DropRequestStatus.OPEN });
      dropRepo.findOne.mockResolvedValue(drop);

      const cancelledDrop = makeDropRequest({ status: DropRequestStatus.CANCELLED });
      dataSource.transaction.mockImplementation(async (fn: any) => {
        const em = {
          save: jest.fn().mockResolvedValue(cancelledDrop),
          update: jest.fn(),
        };
        return fn(em);
      });

      const result = await service.cancel('drop-1', makeStaff());
      expect(result.status).toBe(DropRequestStatus.CANCELLED);
    });
  });
});
