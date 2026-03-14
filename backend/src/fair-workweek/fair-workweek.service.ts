import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ScheduleChangeLog,
  ChangeType,
} from './entities/schedule-change-log.entity';
import { Shift } from '../shifts/entities/shift.entity';
import { SettingsService } from '../settings/settings.service';
import { shiftToUTCRange } from '../common/timezone.util';

export interface ViolationSummary {
  locationId: string | null;
  totalViolations: number;
  totalPredictabilityPayOwed: number;
}

@Injectable()
export class FairWorkweekService {
  constructor(
    @InjectRepository(ScheduleChangeLog)
    private readonly repo: Repository<ScheduleChangeLog>,
    private readonly settingsService: SettingsService,
  ) {}

  // ─── Log Change ───────────────────────────────────────────────────────────

  async logChange(
    shiftId: string,
    changeType: ChangeType,
    changedById: string | null,
    shift: Shift,
  ): Promise<ScheduleChangeLog> {
    const now = new Date();

    // Derive UTC shift start using the existing utility
    const { startUTC } = shiftToUTCRange(
      shift.date,
      shift.startTime,
      shift.endTime,
      shift.location.timezone,
    );

    const hoursBeforeShift =
      (startUTC.getTime() - now.getTime()) / 3_600_000;

    const scheduling = this.settingsService.getScheduling();
    const { advanceNoticeHours, predictabilityPayMultiplier } = scheduling;

    // First publish never triggers predictability pay
    const triggersPredictabilityPay =
      changeType !== ChangeType.PUBLISHED &&
      hoursBeforeShift < advanceNoticeHours;

    let predictabilityPayAmount: number | null = null;

    if (triggersPredictabilityPay) {
      // Compute shift duration in hours
      const { endUTC } = shiftToUTCRange(
        shift.date,
        shift.startTime,
        shift.endTime,
        shift.location.timezone,
      );
      const scheduledHours = (endUTC.getTime() - startUTC.getTime()) / 3_600_000;

      // Use a default hourly rate of 0 when not available on the shift object
      // In practice the caller should ensure the shift has an assigned staff with hourlyRate
      // but for the log we record with the multiplier over base shift hours
      const multiplierExtra = predictabilityPayMultiplier - 1;
      // We log estimated cost per-shift-hour as a percentage extra
      // Actual per-staff amount requires knowing the individual hourlyRate;
      // record the raw "shift_hours * (multiplier - 1)" factor as the amount
      predictabilityPayAmount = parseFloat(
        (scheduledHours * multiplierExtra).toFixed(2),
      );
    }

    const log = this.repo.create({
      shiftId,
      changeType,
      changedAt: now,
      hoursBeforeShift: parseFloat(hoursBeforeShift.toFixed(2)),
      triggersPredictabilityPay,
      predictabilityPayAmount,
      changedById,
    });

    return this.repo.save(log);
  }

  // ─── Get Violations ───────────────────────────────────────────────────────

  async getViolations(
    locationId?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<ScheduleChangeLog[]> {
    const qb = this.repo
      .createQueryBuilder('log')
      .innerJoinAndSelect('log.shift', 'shift')
      .where('log.triggersPredictabilityPay = :flag', { flag: true })
      .orderBy('log.changedAt', 'DESC');

    if (locationId) {
      qb.andWhere('shift.locationId = :locationId', { locationId });
    }

    if (startDate) {
      qb.andWhere('shift.date >= :startDate', { startDate });
    }

    if (endDate) {
      qb.andWhere('shift.date <= :endDate', { endDate });
    }

    return qb.getMany();
  }

  // ─── Summary ──────────────────────────────────────────────────────────────

  async getSummary(locationId?: string): Promise<ViolationSummary> {
    const qb = this.repo
      .createQueryBuilder('log')
      .innerJoin('log.shift', 'shift')
      .where('log.triggersPredictabilityPay = :flag', { flag: true });

    if (locationId) {
      qb.andWhere('shift.locationId = :locationId', { locationId });
    }

    const rows = await qb.getMany();

    const totalViolations = rows.length;
    const totalPredictabilityPayOwed = rows.reduce(
      (sum, r) =>
        sum + (r.predictabilityPayAmount ? Number(r.predictabilityPayAmount) : 0),
      0,
    );

    return {
      locationId: locationId ?? null,
      totalViolations,
      totalPredictabilityPayOwed: parseFloat(
        totalPredictabilityPayOwed.toFixed(2),
      ),
    };
  }
}
