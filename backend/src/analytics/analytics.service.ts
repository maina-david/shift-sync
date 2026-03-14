import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShiftAssignment, AssignmentStatus } from '../shifts/entities/shift-assignment.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { TimeOffRequest, TimeOffStatus } from '../time-off-requests/entities/time-off-request.entity';
import { SwapRequest, SwapRequestStatus } from '../swap-requests/entities/swap-request.entity';
import { DropRequest, DropRequestStatus } from '../drop-requests/entities/drop-request.entity';
import { Reservation, ReservationStatus } from '../reservations/entities/reservation.entity';
import { minutesBetween, weekStart, addDays } from '../common/timezone.util';

const PREMIUM_DAYS = [5, 6];

export interface LiveStatsSnapshot {
  activeShiftsToday: number;
  pendingTimeOff: number;
  swapsAwaitingResponse: number;
  swapsAwaitingManager: number;
  openDrops: number;
  pendingReservations: number;
  timestamp: string;
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(ShiftAssignment) private assignRepo: Repository<ShiftAssignment>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(TimeOffRequest) private timeOffRepo: Repository<TimeOffRequest>,
    @InjectRepository(SwapRequest) private swapRepo: Repository<SwapRequest>,
    @InjectRepository(DropRequest) private dropRepo: Repository<DropRequest>,
    @InjectRepository(Reservation) private reservRepo: Repository<Reservation>,
  ) {}

  async getLiveSnapshot(): Promise<LiveStatsSnapshot> {
    const today = new Date().toISOString().split('T')[0];

    const [
      activeShiftsToday,
      pendingTimeOff,
      swapsAwaitingResponse,
      swapsAwaitingManager,
      openDrops,
      pendingReservations,
    ] = await Promise.all([
      this.assignRepo
        .createQueryBuilder('a')
        .innerJoin('a.shift', 's')
        .where('s.date = :today', { today })
        .andWhere('a.status = :status', { status: AssignmentStatus.ASSIGNED })
        .getCount(),
      this.timeOffRepo.count({ where: { status: TimeOffStatus.PENDING } }),
      this.swapRepo.count({ where: { status: SwapRequestStatus.PENDING } }),
      this.swapRepo.count({ where: { status: SwapRequestStatus.ACCEPTED } }),
      this.dropRepo.count({ where: { status: DropRequestStatus.OPEN } }),
      this.reservRepo.count({ where: { status: ReservationStatus.PENDING, date: today } }),
    ]);

    return {
      activeShiftsToday,
      pendingTimeOff,
      swapsAwaitingResponse,
      swapsAwaitingManager,
      openDrops,
      pendingReservations,
      timestamp: new Date().toISOString(),
    };
  }

  async getHoursDistribution(
    startDate: string,
    endDate: string,
    locationId?: string,
    requestingUser?: User,
  ) {
    const qb = this.assignRepo
      .createQueryBuilder('a')
      .innerJoinAndSelect('a.shift', 'shift')
      .innerJoinAndSelect('a.staff', 'staff')
      .where('a.status = :status', { status: AssignmentStatus.ASSIGNED })
      .andWhere('shift.date >= :startDate AND shift.date <= :endDate', { startDate, endDate });

    if (locationId) qb.andWhere('shift.locationId = :locationId', { locationId });
    if (requestingUser?.role === UserRole.MANAGER) {
      const ids = requestingUser.managedLocations?.map((l) => l.id) ?? ['__none__'];
      qb.andWhere('shift.locationId IN (:...ids)', { ids });
    }

    const assignments = await qb.getMany();

    const staffMap = new Map<string, { name: string; totalMinutes: number; desiredHours: number }>();

    for (const a of assignments) {
      const mins = minutesBetween(a.shift.startTime, a.shift.endTime);
      const key = a.staffId;
      if (!staffMap.has(key)) {
        staffMap.set(key, {
          name: a.staff.name,
          totalMinutes: 0,
          desiredHours: a.staff.desiredHoursPerWeek,
        });
      }
      staffMap.get(key)!.totalMinutes += mins;
    }

    return Array.from(staffMap.entries()).map(([staffId, data]) => ({
      staffId,
      name: data.name,
      totalHours: +(data.totalMinutes / 60).toFixed(2),
      desiredHoursPerWeek: data.desiredHours,
    })).sort((a, b) => b.totalHours - a.totalHours);
  }

  async getFairnessReport(
    startDate: string,
    endDate: string,
    locationId?: string,
    requestingUser?: User,
    crossLocation = false,
  ) {
    // Base query: location-scoped or cross-location
    const scopeQb = this.assignRepo
      .createQueryBuilder('a')
      .innerJoinAndSelect('a.shift', 'shift')
      .innerJoinAndSelect('a.staff', 'staff')
      .where('a.status = :status', { status: AssignmentStatus.ASSIGNED })
      .andWhere('shift.date >= :startDate AND shift.date <= :endDate', { startDate, endDate });

    if (!crossLocation) {
      if (locationId) scopeQb.andWhere('shift.locationId = :locationId', { locationId });
      if (requestingUser?.role === UserRole.MANAGER) {
        const ids = requestingUser.managedLocations?.map((l) => l.id) ?? ['__none__'];
        scopeQb.andWhere('shift.locationId IN (:...ids)', { ids });
      }
    } else if (requestingUser?.role === UserRole.MANAGER) {
      // Cross-location for managers: only their managed locations
      const ids = requestingUser.managedLocations?.map((l) => l.id) ?? ['__none__'];
      scopeQb.andWhere('shift.locationId IN (:...ids)', { ids });
    }

    // When crossLocation AND locationId: find which staff work at target location,
    // then fetch ALL their shifts across all locations for accurate premium ratios
    let assignments = await scopeQb.getMany();

    if (crossLocation && locationId) {
      const staffAtLocation = new Set(assignments.map((a) => a.staffId));
      if (staffAtLocation.size > 0) {
        const allQb = this.assignRepo
          .createQueryBuilder('a')
          .innerJoinAndSelect('a.shift', 'shift')
          .innerJoinAndSelect('a.staff', 'staff')
          .where('a.status = :status', { status: AssignmentStatus.ASSIGNED })
          .andWhere('shift.date >= :startDate AND shift.date <= :endDate', { startDate, endDate })
          .andWhere('a.staffId IN (:...staffIds)', { staffIds: Array.from(staffAtLocation) });
        assignments = await allQb.getMany();
      }
    }

    const staffMap = new Map<string, {
      name: string;
      totalShifts: number;
      premiumShifts: number;
      totalHours: number;
    }>();

    for (const a of assignments) {
      const shiftDate = new Date(a.shift.date + 'T00:00:00Z');
      const day = shiftDate.getUTCDay();
      const isPremium = PREMIUM_DAYS.includes(day) && a.shift.startTime >= '17:00';
      const mins = minutesBetween(a.shift.startTime, a.shift.endTime);

      if (!staffMap.has(a.staffId)) {
        staffMap.set(a.staffId, { name: a.staff.name, totalShifts: 0, premiumShifts: 0, totalHours: 0 });
      }
      const entry = staffMap.get(a.staffId)!;
      entry.totalShifts++;
      if (isPremium) entry.premiumShifts++;
      entry.totalHours += mins / 60;
    }

    const results = Array.from(staffMap.entries()).map(([staffId, d]) => ({
      staffId,
      name: d.name,
      totalShifts: d.totalShifts,
      premiumShifts: d.premiumShifts,
      totalHours: +d.totalHours.toFixed(2),
      premiumRatio: d.totalShifts > 0 ? +(d.premiumShifts / d.totalShifts).toFixed(3) : 0,
    }));

    const ratios = results.map((r) => r.premiumRatio);
    const mean = ratios.reduce((s, v) => s + v, 0) / (ratios.length || 1);
    const variance = ratios.reduce((s, v) => s + (v - mean) ** 2, 0) / (ratios.length || 1);
    const stdDev = Math.sqrt(variance);

    return {
      fairnessScore: +(1 - Math.min(stdDev, 1)).toFixed(3),
      staff: results.sort((a, b) => b.premiumShifts - a.premiumShifts),
    };
  }

  async getOvertimeProjection(weekStartDate: string, locationId?: string, requestingUser?: User) {
    const weekEndDate = addDays(weekStartDate, 7);

    const qb = this.assignRepo
      .createQueryBuilder('a')
      .innerJoinAndSelect('a.shift', 'shift')
      .innerJoinAndSelect('a.staff', 'staff')
      .where('a.status = :status', { status: AssignmentStatus.ASSIGNED })
      .andWhere('shift.date >= :start AND shift.date < :end', {
        start: weekStartDate,
        end: weekEndDate,
      });

    if (locationId) qb.andWhere('shift.locationId = :locationId', { locationId });
    if (requestingUser?.role === UserRole.MANAGER) {
      const ids = requestingUser.managedLocations?.map((l) => l.id) ?? ['__none__'];
      qb.andWhere('shift.locationId IN (:...ids)', { ids });
    }

    const assignments = await qb.getMany();

    const staffMap = new Map<string, {
      name: string;
      hourlyRate: number | null;
      weeklyMinutes: number;
      assignments: Array<{ shiftId: string; date: string; startTime: string; endTime: string; minutes: number }>;
    }>();

    for (const a of assignments) {
      const mins = minutesBetween(a.shift.startTime, a.shift.endTime);
      if (!staffMap.has(a.staffId)) {
        staffMap.set(a.staffId, { name: a.staff.name, hourlyRate: a.staff.hourlyRate, weeklyMinutes: 0, assignments: [] });
      }
      const entry = staffMap.get(a.staffId)!;
      entry.weeklyMinutes += mins;
      entry.assignments.push({
        shiftId: a.shiftId,
        date: a.shift.date,
        startTime: a.shift.startTime,
        endTime: a.shift.endTime,
        minutes: mins,
      });
    }

    return Array.from(staffMap.entries()).map(([staffId, d]) => {
      const weeklyHours = d.weeklyMinutes / 60;
      const overtimeHours = Math.max(0, weeklyHours - 40);
      const rate = d.hourlyRate ? Number(d.hourlyRate) : null;
      const overtimeCost = rate !== null ? +(overtimeHours * 1.5 * rate).toFixed(2) : null;

      let cumulative = 0;
      const annotatedAssignments = d.assignments
        .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
        .map((a) => {
          const prevCumulative = cumulative;
          cumulative += a.minutes / 60;
          const isOvertimePusher = cumulative > 40 && prevCumulative < 40;
          const isInOvertime = prevCumulative >= 40;
          return { ...a, isOvertimePusher, isInOvertime };
        });

      return {
        staffId,
        name: d.name,
        hourlyRate: rate,
        weeklyHours: +weeklyHours.toFixed(2),
        overtimeHours: +overtimeHours.toFixed(2),
        overtimeCost,
        isAtRisk: weeklyHours >= 35,
        isOvertime: weeklyHours > 40,
        assignments: annotatedAssignments,
      };
    }).sort((a, b) => b.weeklyHours - a.weeklyHours);
  }
}
