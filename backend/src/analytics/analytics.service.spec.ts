import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AnalyticsService } from './analytics.service';
import { Shift, ShiftStatus } from '../shifts/entities/shift.entity';
import { ShiftAssignment, AssignmentStatus } from '../shifts/entities/shift-assignment.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { TimeOffRequest, TimeOffStatus } from '../time-off-requests/entities/time-off-request.entity';
import { SwapRequest, SwapRequestStatus } from '../swap-requests/entities/swap-request.entity';
import { DropRequest, DropRequestStatus } from '../drop-requests/entities/drop-request.entity';
import { Reservation, ReservationStatus } from '../reservations/entities/reservation.entity';
import { Location } from '../locations/entities/location.entity';

function buildQb(opts: { getMany?: any[]; getCount?: number; getManyAndCount?: [any[], number]; getRawMany?: any[] } = {}) {
  return {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(opts.getMany ?? []),
    getCount: jest.fn().mockResolvedValue(opts.getCount ?? 0),
    getManyAndCount: jest.fn().mockResolvedValue(opts.getManyAndCount ?? [[], 0]),
    getRawMany: jest.fn().mockResolvedValue(opts.getRawMany ?? []),
  };
}

const makeLocation = (id = 'loc-1'): Location =>
  ({ id, name: 'North Beach', timezone: 'America/Los_Angeles' } as Location);

const makeManager = (): User =>
  ({
    id: 'manager-1',
    role: UserRole.MANAGER,
    managedLocations: [makeLocation()],
  } as unknown as User);

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let shiftRepo: jest.Mocked<any>;
  let assignRepo: jest.Mocked<any>;
  let userRepo: jest.Mocked<any>;
  let timeOffRepo: jest.Mocked<any>;
  let swapRepo: jest.Mocked<any>;
  let dropRepo: jest.Mocked<any>;
  let reservRepo: jest.Mocked<any>;

  beforeEach(async () => {
    shiftRepo = { createQueryBuilder: jest.fn() };
    assignRepo = { createQueryBuilder: jest.fn() };
    userRepo = { find: jest.fn(), createQueryBuilder: jest.fn() };
    timeOffRepo = { count: jest.fn().mockResolvedValue(0) };
    swapRepo = { count: jest.fn().mockResolvedValue(0) };
    dropRepo = { count: jest.fn().mockResolvedValue(0) };
    reservRepo = { count: jest.fn().mockResolvedValue(0) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getRepositoryToken(Shift), useValue: shiftRepo },
        { provide: getRepositoryToken(ShiftAssignment), useValue: assignRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(TimeOffRequest), useValue: timeOffRepo },
        { provide: getRepositoryToken(SwapRequest), useValue: swapRepo },
        { provide: getRepositoryToken(DropRequest), useValue: dropRepo },
        { provide: getRepositoryToken(Reservation), useValue: reservRepo },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  describe('getLiveSnapshot', () => {
    it('returns all zero counts when no data exists', async () => {
      assignRepo.createQueryBuilder.mockReturnValue(buildQb({ getCount: 0 }));

      const result = await service.getLiveSnapshot();
      expect(result.activeShiftsToday).toBe(0);
      expect(result.pendingTimeOff).toBe(0);
      expect(result.swapsAwaitingResponse).toBe(0);
      expect(result.openDrops).toBe(0);
      expect(result.timestamp).toBeDefined();
    });

    it('returns correct non-zero counts', async () => {
      assignRepo.createQueryBuilder.mockReturnValue(buildQb({ getCount: 5 }));
      timeOffRepo.count.mockResolvedValue(3);
      swapRepo.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1);
      dropRepo.count.mockResolvedValue(4);
      reservRepo.count.mockResolvedValue(1);

      const result = await service.getLiveSnapshot();
      expect(result.activeShiftsToday).toBe(5);
      expect(result.pendingTimeOff).toBe(3);
      expect(result.openDrops).toBe(4);
    });
  });

  describe('getHoursDistribution', () => {
    it('returns empty array when no assignments exist', async () => {
      assignRepo.createQueryBuilder.mockReturnValue(buildQb({ getMany: [] }));
      const result = await service.getHoursDistribution('2026-01-01', '2026-01-31');
      expect(result).toEqual([]);
    });

    it('correctly aggregates hours per staff member', async () => {
      const assignments = [
        {
          staffId: 'staff-1',
          staff: { name: 'Alice', desiredHoursPerWeek: 40 },
          shift: { date: '2026-01-05', startTime: '09:00', endTime: '17:00', locationId: 'loc-1' },
        },
        {
          staffId: 'staff-1',
          staff: { name: 'Alice', desiredHoursPerWeek: 40 },
          shift: { date: '2026-01-06', startTime: '09:00', endTime: '17:00', locationId: 'loc-1' },
        },
      ];
      assignRepo.createQueryBuilder.mockReturnValue(buildQb({ getMany: assignments }));

      const result = await service.getHoursDistribution('2026-01-01', '2026-01-31');
      expect(result).toHaveLength(1);
      expect(result[0].staffId).toBe('staff-1');
      expect(result[0].totalHours).toBe(16);
    });

    it('scopes results to manager\'s managed locations', async () => {
      const qb = buildQb({ getMany: [] });
      assignRepo.createQueryBuilder.mockReturnValue(qb);

      await service.getHoursDistribution('2026-01-01', '2026-01-31', undefined, makeManager());
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('locationId'),
        expect.objectContaining({ ids: ['loc-1'] }),
      );
    });
  });

  describe('getFairnessReport', () => {
    it('returns fairnessScore null when no assignments', async () => {
      assignRepo.createQueryBuilder.mockReturnValue(buildQb({ getMany: [] }));
      const result = await service.getFairnessReport('2026-01-01', '2026-01-31');
      expect(result.fairnessScore).toBeNull();
      expect(result.staff).toEqual([]);
    });

    it('identifies premium shifts (Fri/Sat after 17:00)', async () => {
      // 2026-01-03 = Saturday; startTime >= 17:00 → premium
      const assignments = [
        {
          staffId: 'staff-1',
          staff: { name: 'Alice' },
          shift: { date: '2026-01-03', startTime: '18:00', endTime: '23:00', locationId: 'loc-1' },
        },
      ];
      assignRepo.createQueryBuilder.mockReturnValue(buildQb({ getMany: assignments }));

      const result = await service.getFairnessReport('2026-01-01', '2026-01-31');
      expect(result.staff[0].premiumShifts).toBe(1);
    });

    it('returns fairnessScore = 1.0 when all staff have equal premium ratios', async () => {
      const assignments = [
        { staffId: 'staff-1', staff: { name: 'Alice' }, shift: { date: '2026-01-03', startTime: '18:00', endTime: '23:00', locationId: 'loc-1' } },
        { staffId: 'staff-2', staff: { name: 'Bob' }, shift: { date: '2026-01-10', startTime: '18:00', endTime: '23:00', locationId: 'loc-1' } },
      ];
      assignRepo.createQueryBuilder.mockReturnValue(buildQb({ getMany: assignments }));

      const result = await service.getFairnessReport('2026-01-01', '2026-01-31');
      expect(result.fairnessScore).toBe(1);
    });
  });

  describe('getOvertimeProjection', () => {
    it('returns empty array when no assignments exist', async () => {
      assignRepo.createQueryBuilder.mockReturnValue(buildQb({ getMany: [] }));
      const result = await service.getOvertimeProjection('2026-01-13');
      expect(result).toEqual([]);
    });

    it('correctly calculates overtime for staff over 40 hours', async () => {
      const assignments = Array.from({ length: 5 }, (_, i) => ({
        staffId: 'staff-1',
        shiftId: `shift-${i}`,
        staff: { name: 'Alice', hourlyRate: 20 },
        shift: { date: `2026-01-${13 + i}`, startTime: '09:00', endTime: '18:00', locationId: 'loc-1' },
      }));
      assignRepo.createQueryBuilder.mockReturnValue(buildQb({ getMany: assignments }));

      const result = await service.getOvertimeProjection('2026-01-13');
      expect(result[0].weeklyHours).toBe(45);
      expect(result[0].overtimeHours).toBe(5);
      expect(result[0].isOvertime).toBe(true);
      expect(result[0].overtimeCost).toBe(150); // 5h * 1.5 * $20
    });
  });
});
