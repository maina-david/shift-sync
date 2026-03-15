import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShiftAssignment, AssignmentStatus } from './entities/shift-assignment.entity';
import { User } from '../users/entities/user.entity';
import { Shift } from './entities/shift.entity';
import { Availability } from '../users/entities/availability.entity';
import { AvailabilityException } from '../users/entities/availability-exception.entity';
import { shiftToUTCRange, minutesBetween, addDays, weekStart } from '../common/timezone.util';
import { SettingsService } from '../settings/settings.service';

export interface ConstraintViolation {
  rule: string;
  severity: 'error' | 'warning';
  message: string;
}

export interface ConstraintResult {
  valid: boolean;
  violations: ConstraintViolation[];
  warnings: ConstraintViolation[];
}

@Injectable()
export class ConstraintCheckerService {
  constructor(
    @InjectRepository(ShiftAssignment) private assignRepo: Repository<ShiftAssignment>,
    @InjectRepository(Availability) private availRepo: Repository<Availability>,
    @InjectRepository(AvailabilityException) private exceptRepo: Repository<AvailabilityException>,
    private readonly settingsService: SettingsService,
  ) {}

  async check(
    shift: Shift,
    staff: User,
    overrideReason?: string,
  ): Promise<ConstraintResult> {
    const s = this.settingsService.getScheduling();
    const violations: ConstraintViolation[] = [];
    const warnings: ConstraintViolation[] = [];
    const push = (v: ConstraintViolation) =>
      v.severity === 'error' ? violations.push(v) : warnings.push(v);

    const timezone = shift.location.timezone;
    const { startUTC, endUTC } = shiftToUTCRange(shift.date, shift.startTime, shift.endTime, timezone);
    const shiftMinutes = minutesBetween(shift.startTime, shift.endTime);

    const isCertified = staff.certifiedLocations?.some((l) => l.id === shift.locationId);
    if (!isCertified) {
      push({
        rule: 'location_certification',
        severity: 'error',
        message: `${staff.name} is not certified to work at ${shift.location.name}.`,
      });
    }

    if (shift.requiredSkillId) {
      const hasSkill = staff.skills?.some((s) => s.id === shift.requiredSkillId);
      if (!hasSkill) {
        push({
          rule: 'skill_match',
          severity: 'error',
          message: `${staff.name} does not have the required skill: ${shift.requiredSkill?.name ?? shift.requiredSkillId}.`,
        });
      }
    }

    const startMinutes = timeToMinutes(shift.startTime);
    const endMinutes = timeToMinutes(shift.endTime);
    const isOvernight = endMinutes < startMinutes;

    if (isOvernight) {
      // Split availability check at midnight: check current day from start → midnight,
      // then next day from midnight → shift end.
      const startDayViolations = await this.checkDayAvailability(
        staff,
        shift.date,
        startMinutes,
        24 * 60,
      );
      for (const v of startDayViolations) push(v);

      if (endMinutes > 0) {
        const nextDate = addDays(shift.date, 1);
        const nextViolations = await this.checkDayAvailability(
          staff,
          nextDate,
          0,
          endMinutes,
        );
        for (const v of nextViolations) push(v);
      }
    } else {
      const availViolations = await this.checkDayAvailability(
        staff,
        shift.date,
        startMinutes,
        startMinutes + shiftMinutes,
      );
      for (const v of availViolations) push(v);
    }

    const windowStart = new Date(startUTC.getTime() - 14 * 24 * 3600 * 1000);
    const windowEnd = new Date(endUTC.getTime() + 14 * 24 * 3600 * 1000);

    const existingAssignments = await this.assignRepo
      .createQueryBuilder('a')
      .innerJoinAndSelect('a.shift', 'shift')
      .innerJoinAndSelect('shift.location', 'location')
      .where('a.staffId = :staffId', { staffId: staff.id })
      .andWhere('a.status IN (:...statuses)', {
        statuses: [AssignmentStatus.ASSIGNED, AssignmentStatus.PENDING_SWAP],
      })
      .getMany();

    for (const existing of existingAssignments) {
      const exShift = existing.shift;
      const exTz = exShift.location.timezone;
      const { startUTC: exStart, endUTC: exEnd } = shiftToUTCRange(
        exShift.date, exShift.startTime, exShift.endTime, exTz,
      );

      if (exEnd < windowStart || exStart > windowEnd) continue;

      const overlaps = startUTC < exEnd && endUTC > exStart;
      if (overlaps) {
        push({
          rule: 'double_booking',
          severity: 'error',
          message: `${staff.name} is already assigned to a shift at ${exShift.location.name} on ${exShift.date} ${exShift.startTime}–${exShift.endTime} which overlaps with this shift.`,
        });
        continue;
      }

      const gapAfterExisting = (startUTC.getTime() - exEnd.getTime()) / 3600000;
      const gapBeforeExisting = (exStart.getTime() - endUTC.getTime()) / 3600000;

      if (gapAfterExisting >= 0 && gapAfterExisting < s.minRestHours) {
        push({
          rule: 'min_rest',
          severity: 'error',
          message: `Only ${gapAfterExisting.toFixed(1)}h rest between previous shift (${exShift.location.name} ${exShift.startTime}–${exShift.endTime}) and this shift — minimum ${s.minRestHours}h required.`,
        });
      }
      if (gapBeforeExisting >= 0 && gapBeforeExisting < s.minRestHours) {
        push({
          rule: 'min_rest',
          severity: 'error',
          message: `Only ${gapBeforeExisting.toFixed(1)}h rest between this shift and next shift (${exShift.location.name} ${exShift.startTime}–${exShift.endTime}) — minimum ${s.minRestHours}h required.`,
        });
      }
    }

    const sameDay = existingAssignments.filter((a) => a.shift.date === shift.date);
    const dailyMinutes = sameDay.reduce(
      (sum, a) => sum + minutesBetween(a.shift.startTime, a.shift.endTime),
      shiftMinutes,
    );
    const dailyHours = dailyMinutes / 60;
    if (dailyHours > s.dailyBlockHours) {
      push({
        rule: 'daily_hours',
        severity: 'error',
        message: `This would put ${staff.name} at ${dailyHours.toFixed(1)}h on ${shift.date}, exceeding the ${s.dailyBlockHours}-hour daily limit.`,
      });
    } else if (dailyHours > s.dailyWarnHours) {
      push({
        rule: 'daily_hours',
        severity: 'warning',
        message: `${staff.name} would work ${dailyHours.toFixed(1)}h on ${shift.date} (${s.dailyWarnHours}h daily threshold).`,
      });
    }

    const wk = weekStart(shift.date);
    const wkEnd = addDays(wk, 7);
    const weekAssignments = existingAssignments.filter(
      (a) => a.shift.date >= wk && a.shift.date < wkEnd,
    );
    const weeklyMinutes = weekAssignments.reduce(
      (sum, a) => sum + minutesBetween(a.shift.startTime, a.shift.endTime),
      shiftMinutes,
    );
    const weeklyHours = weeklyMinutes / 60;
    if (weeklyHours >= s.weeklyOvertimeHours) {
      push({
        rule: 'weekly_hours',
        severity: 'warning',
        message: `${staff.name} would reach ${weeklyHours.toFixed(1)}h this week (week of ${wk}), entering overtime territory (${s.weeklyOvertimeHours}h+).`,
      });
    } else if (weeklyHours >= s.weeklyWarnHours) {
      push({
        rule: 'weekly_hours',
        severity: 'warning',
        message: `${staff.name} is approaching ${s.weeklyOvertimeHours}h: projected ${weeklyHours.toFixed(1)}h this week.`,
      });
    }

    const consecutiveDays = await this.countConsecutiveDays(staff.id, shift.date);
    if (consecutiveDays >= s.maxConsecutiveDaysHard) {
      if (!overrideReason) {
        push({
          rule: 'consecutive_days',
          severity: 'error',
          message: `${staff.name} would work their ${s.maxConsecutiveDaysHard}th consecutive day. A manager override with documented reason is required.`,
        });
      } else {
        push({
          rule: 'consecutive_days',
          severity: 'warning',
          message: `Override applied: ${staff.name} working ${s.maxConsecutiveDaysHard}th consecutive day. Reason: ${overrideReason}`,
        });
      }
    } else if (consecutiveDays === s.maxConsecutiveDays) {
      push({
        rule: 'consecutive_days',
        severity: 'warning',
        message: `${staff.name} would be working their ${s.maxConsecutiveDays}th consecutive day.`,
      });
    }

    return {
      valid: violations.length === 0,
      violations,
      warnings,
    };
  }

  private async checkDayAvailability(
    staff: User,
    date: string,
    shiftStartMin: number,
    shiftEndMin: number,
  ): Promise<ConstraintViolation[]> {
    const violations: ConstraintViolation[] = [];
    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayOfWeek = new Date(date + 'T00:00:00Z').getUTCDay();

    const exception = await this.exceptRepo.findOne({ where: { userId: staff.id, date } });
    if (exception) {
      if (exception.isUnavailable) {
        violations.push({
          rule: 'availability',
          severity: 'error',
          message: `${staff.name} has marked ${date} as completely unavailable.`,
        });
      } else if (exception.startTime && exception.endTime) {
        const avStart = timeToMinutes(exception.startTime);
        const avEnd = timeToMinutes(exception.endTime);
        if (shiftStartMin < avStart || shiftEndMin > avEnd) {
          violations.push({
            rule: 'availability',
            severity: 'error',
            message: `${staff.name} is only available ${exception.startTime}–${exception.endTime} on ${date} (exception).`,
          });
        }
      }
    } else {
      const avail = await this.availRepo.findOne({ where: { userId: staff.id, dayOfWeek } });
      if (!avail) {
        violations.push({
          rule: 'availability',
          severity: 'error',
          message: `${staff.name} has no availability set for ${DAY_NAMES[dayOfWeek]}s.`,
        });
      } else {
        const avStart = timeToMinutes(avail.startTime);
        const avEnd = timeToMinutes(avail.endTime);
        if (shiftStartMin < avStart || shiftEndMin > avEnd) {
          violations.push({
            rule: 'availability',
            severity: 'error',
            message: `${staff.name} is only available ${avail.startTime}–${avail.endTime} on ${DAY_NAMES[dayOfWeek]}s.`,
          });
        }
      }
    }
    return violations;
  }

  private async countConsecutiveDays(staffId: string, targetDate: string): Promise<number> {
    // Query a ±13-day window to capture any consecutive run that includes targetDate.
    // This queries the DB directly so it accounts for shifts outside any in-memory dataset.
    const windowStart = addDays(targetDate, -13);
    const windowEnd = addDays(targetDate, 13);

    const rows = await this.assignRepo
      .createQueryBuilder('a')
      .innerJoin('a.shift', 'shift')
      .select('shift.date', 'date')
      .where('a.staffId = :staffId', { staffId })
      .andWhere('a.status IN (:...statuses)', {
        statuses: [AssignmentStatus.ASSIGNED, AssignmentStatus.PENDING_SWAP],
      })
      .andWhere('shift.date >= :windowStart AND shift.date <= :windowEnd', { windowStart, windowEnd })
      .getRawMany<{ date: string }>();

    const workedDates = new Set(rows.map((r) => r.date));
    workedDates.add(targetDate);

    let count = 0;
    let date = targetDate;
    while (workedDates.has(date)) {
      count++;
      date = addDays(date, -1);
    }
    let fwd = addDays(targetDate, 1);
    while (workedDates.has(fwd)) {
      count++;
      fwd = addDays(fwd, 1);
    }
    return count;
  }
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}
