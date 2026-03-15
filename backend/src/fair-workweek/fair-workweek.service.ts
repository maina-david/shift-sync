import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScheduleChangeLog } from './entities/schedule-change-log.entity';

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
  ) {}

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

  async getSummary(locationId?: string): Promise<ViolationSummary> {
    const qb = this.repo
      .createQueryBuilder('log')
      .innerJoin('log.shift', 'shift')
      .where('log.triggersPredictabilityPay = :flag', { flag: true });

    if (locationId) {
      qb.andWhere('shift.locationId = :locationId', { locationId });
    }

    const rows = await qb.getMany();

    const totalPredictabilityPayOwed = rows.reduce(
      (sum, r) =>
        sum +
        (r.predictabilityPayAmount ? Number(r.predictabilityPayAmount) : 0),
      0,
    );

    return {
      locationId: locationId ?? null,
      totalViolations: rows.length,
      totalPredictabilityPayOwed: parseFloat(
        totalPredictabilityPayOwed.toFixed(2),
      ),
    };
  }
}
