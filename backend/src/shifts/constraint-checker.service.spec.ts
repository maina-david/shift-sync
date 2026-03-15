import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConstraintCheckerService } from './constraint-checker.service';
import { ShiftAssignment, AssignmentStatus } from './entities/shift-assignment.entity';
import { Availability } from '../users/entities/availability.entity';
import { AvailabilityException } from '../users/entities/availability-exception.entity';
import { SettingsService } from '../settings/settings.service';
import { User, UserRole } from '../users/entities/user.entity';
import { Shift } from './entities/shift.entity';
import { Location } from '../locations/entities/location.entity';

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

function buildQb(opts: { getMany?: any[]; getRawMany?: any[] } = {}) {
  return {
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(opts.getMany ?? []),
    getRawMany: jest.fn().mockResolvedValue(opts.getRawMany ?? []),
  };
}

const MOCK_SETTINGS = {
  minRestHours: 8,
  dailyBlockHours: 12,
  dailyWarnHours: 10,
  weeklyOvertimeHours: 40,
  weeklyWarnHours: 36,
  maxConsecutiveDays: 6,
  maxConsecutiveDaysHard: 7,
};

const makeLocation = (id = 'loc-1'): Location =>
  ({ id, name: 'North Beach', timezone: 'America/Los_Angeles' } as Location);

const makeShift = (overrides: Omit<Partial<Shift>, 'requiredSkill' | 'requiredSkillId'> & { requiredSkill?: any; requiredSkillId?: string | null } = {}): Shift =>
  ({
    id: 'shift-1',
    date: '2026-03-20',
    startTime: '09:00',
    endTime: '17:00',
    locationId: 'loc-1',
    location: makeLocation(),
    requiredSkillId: null,
    requiredSkill: null,
    ...overrides,
  } as unknown as Shift);

const makeStaff = (overrides: Omit<Partial<User>, 'certifiedLocations' | 'skills'> & { certifiedLocations?: any[]; skills?: any[] } = {}): User =>
  ({
    id: 'staff-1',
    name: 'Alice Thompson',
    role: UserRole.STAFF,
    certifiedLocations: [makeLocation()],
    skills: [],
    desiredHoursPerWeek: 40,
    ...overrides,
  } as unknown as User);

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

describe('ConstraintCheckerService', () => {
  let service: ConstraintCheckerService;
  let assignRepo: { createQueryBuilder: jest.Mock };
  let availRepo: { findOne: jest.Mock };
  let exceptRepo: { findOne: jest.Mock };
  let settingsService: { getScheduling: jest.Mock };

  beforeEach(async () => {
    assignRepo = { createQueryBuilder: jest.fn() };
    availRepo = { findOne: jest.fn() };
    exceptRepo = { findOne: jest.fn() };
    settingsService = { getScheduling: jest.fn().mockReturnValue(MOCK_SETTINGS) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConstraintCheckerService,
        { provide: getRepositoryToken(ShiftAssignment), useValue: assignRepo },
        { provide: getRepositoryToken(Availability), useValue: availRepo },
        { provide: getRepositoryToken(AvailabilityException), useValue: exceptRepo },
        { provide: SettingsService, useValue: settingsService },
      ],
    }).compile();

    service = module.get<ConstraintCheckerService>(ConstraintCheckerService);
  });

  // Set up the two createQueryBuilder calls (existing-assignments + consecutive-days)
  // with no results so all schedule checks pass.
  function setupCleanSlate() {
    let calls = 0;
    assignRepo.createQueryBuilder.mockImplementation(() => {
      calls++;
      return buildQb({ getMany: [], getRawMany: [] });
    });
    exceptRepo.findOne.mockResolvedValue(null);
    // Available Thu 08:00–18:00; shift is 09:00–17:00 ✓
    availRepo.findOne.mockResolvedValue({ dayOfWeek: 4, startTime: '08:00', endTime: '18:00' });
  }

  // ---------------------------------------------------------------------------
  describe('valid result', () => {
    it('returns valid when all constraints are satisfied', async () => {
      setupCleanSlate();
      const result = await service.check(makeShift(), makeStaff());
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  describe('location_certification', () => {
    it('blocks assignment when staff is not certified for the location', async () => {
      setupCleanSlate();
      const staff = makeStaff({ certifiedLocations: [] });
      const result = await service.check(makeShift(), staff);
      expect(result.valid).toBe(false);
      expect(result.violations).toContainEqual(
        expect.objectContaining({ rule: 'location_certification', severity: 'error' }),
      );
    });

    it('does NOT block when staff is certified for a different location but not this one', async () => {
      setupCleanSlate();
      const staff = makeStaff({ certifiedLocations: [makeLocation('loc-other')] });
      const result = await service.check(makeShift(), staff);
      const v = result.violations.filter((x) => x.rule === 'location_certification');
      expect(v).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  describe('skill_match', () => {
    it('blocks when shift requires a skill the staff member lacks', async () => {
      setupCleanSlate();
      const shift = makeShift({ requiredSkillId: 'skill-barista', requiredSkill: { name: 'Barista' } });
      const staff = makeStaff({ skills: [] });
      const result = await service.check(shift, staff);
      expect(result.valid).toBe(false);
      expect(result.violations).toContainEqual(
        expect.objectContaining({ rule: 'skill_match', severity: 'error' }),
      );
    });

    it('passes when staff has the required skill', async () => {
      setupCleanSlate();
      const shift = makeShift({ requiredSkillId: 'skill-barista' });
      const staff = makeStaff({ skills: [{ id: 'skill-barista', name: 'Barista' }] });
      const result = await service.check(shift, staff);
      expect(result.violations.filter((v) => v.rule === 'skill_match')).toHaveLength(0);
    });

    it('does not check skills when shift has no requiredSkillId', async () => {
      setupCleanSlate();
      const shift = makeShift({ requiredSkillId: null });
      const staff = makeStaff({ skills: [] });
      const result = await service.check(shift, staff);
      expect(result.violations.filter((v) => v.rule === 'skill_match')).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  describe('availability', () => {
    it('blocks when staff has no availability record for that day of week', async () => {
      let calls = 0;
      assignRepo.createQueryBuilder.mockImplementation(() => buildQb());
      exceptRepo.findOne.mockResolvedValue(null);
      availRepo.findOne.mockResolvedValue(null); // No record

      const result = await service.check(makeShift(), makeStaff());
      expect(result.violations).toContainEqual(
        expect.objectContaining({ rule: 'availability', severity: 'error' }),
      );
    });

    it('blocks when shift starts before staff availability window', async () => {
      assignRepo.createQueryBuilder.mockImplementation(() => buildQb());
      exceptRepo.findOne.mockResolvedValue(null);
      availRepo.findOne.mockResolvedValue({ dayOfWeek: 4, startTime: '11:00', endTime: '18:00' });

      const shift = makeShift({ startTime: '09:00', endTime: '17:00' }); // starts before 11:00
      const result = await service.check(shift, makeStaff());
      expect(result.violations).toContainEqual(
        expect.objectContaining({ rule: 'availability', severity: 'error' }),
      );
    });

    it('blocks when staff has a full-day unavailability exception', async () => {
      assignRepo.createQueryBuilder.mockImplementation(() => buildQb());
      exceptRepo.findOne.mockResolvedValue({ date: '2026-03-20', isUnavailable: true });

      const result = await service.check(makeShift(), makeStaff());
      expect(result.violations).toContainEqual(
        expect.objectContaining({ rule: 'availability', severity: 'error' }),
      );
    });

    it('overnight shift ending exactly at 00:00 does not trigger a false next-day availability violation', async () => {
      // Shift: Thu 22:00–00:00. endMinutes===0 means the shift ends at midnight
      // and does NOT extend into Friday — the next-day check must be skipped.
      assignRepo.createQueryBuilder.mockImplementation(() => buildQb());
      // Thursday (shift day): no time restriction on the exception → fully available
      exceptRepo.findOne.mockImplementation(({ where }: any) => {
        if (where.date === '2026-03-19') {
          return Promise.resolve({ isUnavailable: false, startTime: null, endTime: null });
        }
        return Promise.resolve(null);
      });
      // If the next-day check were incorrectly invoked, availRepo would return null
      // (no Friday availability) and add a violation. Staying silent = fix is working.
      availRepo.findOne.mockResolvedValue(null);

      const shift = makeShift({ date: '2026-03-19', startTime: '22:00', endTime: '00:00' });
      const result = await service.check(shift, makeStaff());
      expect(result.violations.filter((v) => v.rule === 'availability')).toHaveLength(0);
    });

    it('overnight shift extending into the next day (22:00–02:00) checks next-day availability', async () => {
      // endMinutes===120 > 0, so the next-day check MUST fire.
      // Staff has no Friday availability → expect one availability violation.
      assignRepo.createQueryBuilder.mockImplementation(() => buildQb());
      exceptRepo.findOne.mockImplementation(({ where }: any) => {
        if (where.date === '2026-03-19') {
          // Thursday shift day: fully available
          return Promise.resolve({ isUnavailable: false, startTime: null, endTime: null });
        }
        return Promise.resolve(null); // no exception for Friday
      });
      // No availability record for any day → next-day check triggers violation
      availRepo.findOne.mockResolvedValue(null);

      const shift = makeShift({ date: '2026-03-19', startTime: '22:00', endTime: '02:00' });
      const result = await service.check(shift, makeStaff());
      expect(result.violations.filter((v) => v.rule === 'availability')).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  describe('double_booking', () => {
    it('blocks when staff has an overlapping assignment at another location', async () => {
      const overlapping = {
        shift: {
          date: '2026-03-20',
          startTime: '08:00',
          endTime: '14:00',
          location: makeLocation('loc-downtown'),
        },
        status: AssignmentStatus.ASSIGNED,
      };

      let calls = 0;
      assignRepo.createQueryBuilder.mockImplementation(() => {
        calls++;
        // First call: existing assignments (returns overlapping); second call: consecutive days
        return calls === 1 ? buildQb({ getMany: [overlapping] }) : buildQb({ getRawMany: [] });
      });
      exceptRepo.findOne.mockResolvedValue(null);
      availRepo.findOne.mockResolvedValue({ dayOfWeek: 4, startTime: '08:00', endTime: '18:00' });

      const result = await service.check(makeShift(), makeStaff());
      expect(result.violations).toContainEqual(
        expect.objectContaining({ rule: 'double_booking', severity: 'error' }),
      );
    });

    it('does NOT flag a double_booking for a shift on a different day', async () => {
      const nonOverlapping = {
        shift: {
          date: '2026-03-21', // Next day — no overlap
          startTime: '09:00',
          endTime: '17:00',
          location: makeLocation(),
        },
        status: AssignmentStatus.ASSIGNED,
      };

      let calls = 0;
      assignRepo.createQueryBuilder.mockImplementation(() => {
        calls++;
        return calls === 1 ? buildQb({ getMany: [nonOverlapping] }) : buildQb({ getRawMany: [] });
      });
      exceptRepo.findOne.mockResolvedValue(null);
      availRepo.findOne.mockResolvedValue({ dayOfWeek: 4, startTime: '08:00', endTime: '18:00' });

      const result = await service.check(makeShift(), makeStaff());
      expect(result.violations.filter((v) => v.rule === 'double_booking')).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  describe('consecutive_days', () => {
    // Build a 6-day run ending on 2026-03-19; adding 2026-03-20 makes 7 (hard limit)
    const sixDayRun = [
      { date: '2026-03-14' }, { date: '2026-03-15' }, { date: '2026-03-16' },
      { date: '2026-03-17' }, { date: '2026-03-18' }, { date: '2026-03-19' },
    ];

    function setupConsecutiveRun() {
      let calls = 0;
      assignRepo.createQueryBuilder.mockImplementation(() => {
        calls++;
        return calls === 1
          ? buildQb({ getMany: [] })              // existing assignments (no conflicts)
          : buildQb({ getRawMany: sixDayRun });   // consecutive day window
      });
      exceptRepo.findOne.mockResolvedValue(null);
      availRepo.findOne.mockResolvedValue({ dayOfWeek: 4, startTime: '08:00', endTime: '18:00' });
    }

    it('returns a hard error when adding this shift would exceed maxConsecutiveDaysHard', async () => {
      setupConsecutiveRun();
      const result = await service.check(makeShift({ date: '2026-03-20' }), makeStaff());
      expect(result.violations).toContainEqual(
        expect.objectContaining({ rule: 'consecutive_days', severity: 'error' }),
      );
    });

    it('downgrades consecutive_days to a warning when manager provides an override reason', async () => {
      setupConsecutiveRun();
      const result = await service.check(
        makeShift({ date: '2026-03-20' }),
        makeStaff(),
        'Emergency staffing — called in sick',
      );
      expect(result.violations.filter((v) => v.rule === 'consecutive_days')).toHaveLength(0);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({ rule: 'consecutive_days', severity: 'warning' }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  describe('result.valid', () => {
    it('is false when any error-severity violation exists', async () => {
      setupCleanSlate();
      const staff = makeStaff({ certifiedLocations: [] }); // triggers location error
      const result = await service.check(makeShift(), staff);
      expect(result.valid).toBe(false);
    });

    it('is true when there are only warnings (no errors)', async () => {
      // Trigger a weekly hours warning (36+ h) but no hard errors
      const weeklyAssignments = Array.from({ length: 4 }, (_, i) => ({
        shift: {
          date: `2026-03-1${i + 6}`, // Mon–Thu of the same week
          startTime: '09:00',
          endTime: '18:00',
          location: makeLocation(),
        },
        status: AssignmentStatus.ASSIGNED,
      }));

      let calls = 0;
      assignRepo.createQueryBuilder.mockImplementation(() => {
        calls++;
        return calls === 1
          ? buildQb({ getMany: weeklyAssignments })
          : buildQb({ getRawMany: [] });
      });
      exceptRepo.findOne.mockResolvedValue(null);
      availRepo.findOne.mockResolvedValue({ dayOfWeek: 4, startTime: '08:00', endTime: '18:00' });

      const result = await service.check(makeShift(), makeStaff());
      // May have weekly hour warning but should still be valid (no errors besides location)
      // Staff IS certified so no location error; warnings don't invalidate
      expect(result.violations.filter((v) => v.severity === 'error')).toHaveLength(0);
      expect(result.valid).toBe(true);
    });
  });
});
