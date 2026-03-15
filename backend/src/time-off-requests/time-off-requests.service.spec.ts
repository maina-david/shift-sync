import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TimeOffRequestsService } from './time-off-requests.service';
import {
  TimeOffRequest,
  TimeOffStatus,
} from './entities/time-off-request.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { Location } from '../locations/entities/location.entity';

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

function buildQb(
  opts: {
    getOne?: any;
    getMany?: any[];
    getManyAndCount?: [any[], number];
  } = {},
) {
  return {
    createQueryBuilder: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(opts.getOne ?? null),
    getMany: jest.fn().mockResolvedValue(opts.getMany ?? []),
    getManyAndCount: jest
      .fn()
      .mockResolvedValue(opts.getManyAndCount ?? [[], 0]),
  };
}

const TODAY = new Date().toISOString().slice(0, 10);
const FUTURE = '2099-12-01';
const FUTURE_END = '2099-12-07';

const makeStaff = (overrides: Partial<User> = {}): User =>
  ({
    id: 'staff-1',
    name: 'Alice Thompson',
    role: UserRole.STAFF,
    certifiedLocations: [{ id: 'loc-1' } as Location],
    ...overrides,
  }) as User;

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

const makeRequest = (overrides: Partial<TimeOffRequest> = {}): TimeOffRequest =>
  ({
    id: 'tor-1',
    staffId: 'staff-1',
    startDate: FUTURE,
    endDate: FUTURE_END,
    reason: null,
    status: TimeOffStatus.PENDING,
    reviewedById: null,
    managerNote: null,
    reviewedAt: null,
    ...overrides,
  }) as unknown as TimeOffRequest;

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

describe('TimeOffRequestsService', () => {
  let service: TimeOffRequestsService;
  let repo: jest.Mocked<any>;
  let userRepo: jest.Mocked<any>;
  let events: jest.Mocked<any>;
  let dataSource: jest.Mocked<any>;

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    userRepo = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    events = { emit: jest.fn() };
    dataSource = { transaction: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimeOffRequestsService,
        { provide: getRepositoryToken(TimeOffRequest), useValue: repo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: EventEmitter2, useValue: events },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<TimeOffRequestsService>(TimeOffRequestsService);
  });

  // ---------------------------------------------------------------------------
  describe('create', () => {
    const dto = { startDate: FUTURE, endDate: FUTURE_END, reason: undefined };

    it('throws BadRequestException when endDate is before startDate', async () => {
      await expect(
        service.create({ startDate: FUTURE_END, endDate: FUTURE }, makeStaff()),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when startDate is in the past', async () => {
      await expect(
        service.create(
          { startDate: '2020-01-01', endDate: '2020-01-05' },
          makeStaff(),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when an overlapping pending request exists', async () => {
      const em = { createQueryBuilder: jest.fn() };
      const conflictingRequest = makeRequest();
      const qb = buildQb({ getOne: conflictingRequest });
      em.createQueryBuilder.mockReturnValue(qb);
      dataSource.transaction.mockImplementation((fn: any) => fn(em));

      await expect(service.create(dto, makeStaff())).rejects.toThrow(
        BadRequestException,
      );
    });

    it('creates and returns the request when no conflicts exist', async () => {
      const saved = makeRequest();
      const em = {
        createQueryBuilder: jest
          .fn()
          .mockReturnValue(buildQb({ getOne: null })),
        create: jest.fn().mockReturnValue(saved),
        save: jest.fn().mockResolvedValue(saved),
      };
      dataSource.transaction.mockImplementation((fn: any) => fn(em));

      const result = await service.create(dto, makeStaff());
      expect(result.staffId).toBe('staff-1');
      expect(result.status).toBe(TimeOffStatus.PENDING);
    });

    it('emits time-off.requested after successful creation', async () => {
      const saved = makeRequest();
      const em = {
        createQueryBuilder: jest
          .fn()
          .mockReturnValue(buildQb({ getOne: null })),
        create: jest.fn().mockReturnValue(saved),
        save: jest.fn().mockResolvedValue(saved),
      };
      dataSource.transaction.mockImplementation((fn: any) => fn(em));

      await service.create(dto, makeStaff());
      expect(events.emit).toHaveBeenCalledWith(
        'time-off.requested',
        expect.objectContaining({ staffId: 'staff-1' }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  describe('list', () => {
    it("returns only the requesting staff member's own requests", async () => {
      const staffRequest = makeRequest({ staffId: 'staff-1' });
      repo.findAndCount.mockResolvedValue([[staffRequest], 1]);

      const result = await service.list(makeStaff());
      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { staffId: 'staff-1' } }),
      );
      expect(result.total).toBe(1);
    });

    it('returns empty list for a manager with no managed locations', async () => {
      const manager = makeManager([]);
      const result = await service.list(manager);
      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('scopes manager results to staff at their managed locations', async () => {
      const manager = makeManager(['loc-1']);
      const staffUser = { id: 'staff-1' };
      const staffQb = buildQb({ getMany: [staffUser] });
      userRepo.createQueryBuilder.mockReturnValue(staffQb);

      const request = makeRequest({ staffId: 'staff-1' });
      repo.findAndCount.mockResolvedValue([[request], 1]);

      const result = await service.list(manager);
      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ staffId: expect.anything() }),
        }),
      );
      expect(result.total).toBe(1);
    });

    it('returns empty when manager has no staff at their locations', async () => {
      const manager = makeManager(['loc-1']);
      const staffQb = buildQb({ getMany: [] }); // No staff at those locations
      userRepo.createQueryBuilder.mockReturnValue(staffQb);

      const result = await service.list(manager);
      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('returns all requests for admins without location filtering', async () => {
      const allRequests = [
        makeRequest({ staffId: 'staff-1' }),
        makeRequest({ staffId: 'staff-2' }),
      ];
      repo.findAndCount.mockResolvedValue([allRequests, 2]);

      const result = await service.list(makeAdmin());
      expect(result.total).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  describe('approve', () => {
    it('throws NotFoundException when request does not exist', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.approve('missing-id', makeAdmin())).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when request is not PENDING', async () => {
      repo.findOne.mockResolvedValue(
        makeRequest({ status: TimeOffStatus.APPROVED }),
      );
      await expect(service.approve('tor-1', makeAdmin())).rejects.toThrow(
        BadRequestException,
      );
    });

    it("throws ForbiddenException when manager does not manage the staff member's location", async () => {
      repo.findOne.mockResolvedValue(makeRequest());
      // Manager manages loc-99, staff is certified for loc-1 only
      userRepo.findOne
        .mockResolvedValueOnce({
          id: 'manager-1',
          managedLocations: [{ id: 'loc-99' }],
        })
        .mockResolvedValueOnce({
          id: 'staff-1',
          certifiedLocations: [{ id: 'loc-1' }],
        });

      await expect(
        service.approve('tor-1', makeManager(['loc-99'])),
      ).rejects.toThrow(ForbiddenException);
    });

    it('approves when manager manages a location the staff is certified for', async () => {
      const request = makeRequest();
      repo.findOne.mockResolvedValue(request);
      userRepo.findOne
        .mockResolvedValueOnce({
          id: 'manager-1',
          managedLocations: [{ id: 'loc-1' }],
        })
        .mockResolvedValueOnce({
          id: 'staff-1',
          certifiedLocations: [{ id: 'loc-1' }],
        });
      repo.save.mockImplementation((r: any) => Promise.resolve(r));

      const result = await service.approve('tor-1', makeManager(['loc-1']));
      expect(result.status).toBe(TimeOffStatus.APPROVED);
    });

    it('emits audit.log after approval', async () => {
      repo.findOne.mockResolvedValue(makeRequest());
      userRepo.findOne
        .mockResolvedValueOnce({
          id: 'manager-1',
          managedLocations: [{ id: 'loc-1' }],
        })
        .mockResolvedValueOnce({
          id: 'staff-1',
          certifiedLocations: [{ id: 'loc-1' }],
        });
      repo.save.mockImplementation((r: any) => Promise.resolve(r));

      await service.approve('tor-1', makeManager(['loc-1']));
      expect(events.emit).toHaveBeenCalledWith(
        'audit.log',
        expect.objectContaining({
          entity: 'time_off_request',
          action: 'approved',
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  describe('deny', () => {
    it('throws BadRequestException when request is not PENDING', async () => {
      repo.findOne.mockResolvedValue(
        makeRequest({ status: TimeOffStatus.DENIED }),
      );
      await expect(service.deny('tor-1', makeAdmin())).rejects.toThrow(
        BadRequestException,
      );
    });

    it('denies the request and emits audit.log', async () => {
      const request = makeRequest();
      repo.findOne.mockResolvedValue(request);
      userRepo.findOne
        .mockResolvedValueOnce({
          id: 'manager-1',
          managedLocations: [{ id: 'loc-1' }],
        })
        .mockResolvedValueOnce({
          id: 'staff-1',
          certifiedLocations: [{ id: 'loc-1' }],
        });
      repo.save.mockImplementation((r: any) => Promise.resolve(r));

      const result = await service.deny(
        'tor-1',
        makeManager(['loc-1']),
        'No coverage available',
      );
      expect(result.status).toBe(TimeOffStatus.DENIED);
      expect(events.emit).toHaveBeenCalledWith(
        'audit.log',
        expect.objectContaining({ action: 'denied' }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  describe('cancel', () => {
    it('throws ForbiddenException when a different user tries to cancel', async () => {
      repo.findOne.mockResolvedValue(makeRequest({ staffId: 'staff-1' }));
      const otherStaff = makeStaff({ id: 'staff-99' });
      await expect(service.cancel('tor-1', otherStaff)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws BadRequestException when request is not PENDING', async () => {
      repo.findOne.mockResolvedValue(
        makeRequest({ status: TimeOffStatus.APPROVED }),
      );
      await expect(service.cancel('tor-1', makeStaff())).rejects.toThrow(
        BadRequestException,
      );
    });

    it('cancels the request when called by the owner', async () => {
      const request = makeRequest();
      repo.findOne.mockResolvedValue(request);
      repo.save.mockImplementation((r: any) => Promise.resolve(r));

      const result = await service.cancel('tor-1', makeStaff());
      expect(result.status).toBe(TimeOffStatus.CANCELLED);
    });
  });
});
