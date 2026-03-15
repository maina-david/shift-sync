import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shift, ShiftStatus } from '../shifts/entities/shift.entity';
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
    @InjectRepository(Shift) private shiftRepo: Repository<Shift>,
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
      let entry = staffMap.get(key);
      if (!entry) {
        entry = { name: a.staff.name, totalMinutes: 0, desiredHours: a.staff.desiredHoursPerWeek };
        staffMap.set(key, entry);
      }
      entry.totalMinutes += mins;
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

      let entry = staffMap.get(a.staffId);
      if (!entry) {
        entry = { name: a.staff.name, totalShifts: 0, premiumShifts: 0, totalHours: 0 };
        staffMap.set(a.staffId, entry);
      }
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

    if (results.length === 0) {
      return { fairnessScore: null, staff: [] };
    }

    const ratios = results.map((r) => r.premiumRatio);
    const mean = ratios.reduce((s, v) => s + v, 0) / ratios.length;
    const variance = ratios.reduce((s, v) => s + (v - mean) ** 2, 0) / ratios.length;
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
      assignments: Array<{ assignmentId: string; shiftId: string; date: string; startTime: string; endTime: string; minutes: number }>;
    }>();

    for (const a of assignments) {
      const mins = minutesBetween(a.shift.startTime, a.shift.endTime);
      let entry = staffMap.get(a.staffId);
      if (!entry) {
        entry = { name: a.staff.name, hourlyRate: a.staff.hourlyRate, weeklyMinutes: 0, assignments: [] };
        staffMap.set(a.staffId, entry);
      }
      entry.weeklyMinutes += mins;
      entry.assignments.push({
        assignmentId: a.id,
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

  // ─── PART 1: NEW ANALYTICS METHODS ─────────────────────────────────────────

  async getLaborCost(startDate: string, endDate: string, locationId?: string, requestingUser?: User) {
    const qb = this.shiftRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.assignments', 'a')
      .leftJoinAndSelect('a.staff', 'staff')
      .leftJoinAndSelect('s.location', 'loc')
      .where('s.status = :status', { status: ShiftStatus.PUBLISHED })
      .andWhere('s.date >= :startDate AND s.date <= :endDate', { startDate, endDate });

    if (locationId) qb.andWhere('s.locationId = :locationId', { locationId });
    if (requestingUser?.role === UserRole.MANAGER) {
      const ids = requestingUser.managedLocations?.map((l) => l.id) ?? ['__none__'];
      qb.andWhere('s.locationId IN (:...ids)', { ids });
    }

    const shifts = await qb.getMany();

    let totalScheduledHours = 0;
    let totalLaborCost = 0;

    const byLocationMap = new Map<string, {
      name: string;
      scheduledHours: number;
      laborCost: number;
      shiftCount: number;
    }>();

    const byDateMap = new Map<string, { laborCost: number; scheduledHours: number }>();

    for (const shift of shifts) {
      const scheduledHours = minutesBetween(shift.startTime, shift.endTime) / 60;
      const activeAssignments = (shift.assignments ?? []).filter(
        (a) => a.status === AssignmentStatus.ASSIGNED || a.status === AssignmentStatus.COMPLETED,
      );
      const shiftLaborCost = scheduledHours * activeAssignments.reduce((sum, a) => {
        return sum + (a.staff?.hourlyRate ? Number(a.staff.hourlyRate) : 0);
      }, 0);

      totalScheduledHours += scheduledHours;
      totalLaborCost += shiftLaborCost;

      // By location
      const locId = shift.locationId;
      const locName = shift.location?.name ?? locId;
      let locEntry = byLocationMap.get(locId);
      if (!locEntry) {
        locEntry = { name: locName, scheduledHours: 0, laborCost: 0, shiftCount: 0 };
        byLocationMap.set(locId, locEntry);
      }
      locEntry.scheduledHours += scheduledHours;
      locEntry.laborCost += shiftLaborCost;
      locEntry.shiftCount += 1;

      let dateEntry = byDateMap.get(shift.date);
      if (!dateEntry) {
        dateEntry = { laborCost: 0, scheduledHours: 0 };
        byDateMap.set(shift.date, dateEntry);
      }
      dateEntry.laborCost += shiftLaborCost;
      dateEntry.scheduledHours += scheduledHours;
    }

    return {
      totalScheduledHours: +totalScheduledHours.toFixed(2),
      totalLaborCost: +totalLaborCost.toFixed(2),
      byLocation: Array.from(byLocationMap.entries()).map(([locId, d]) => ({
        locationId: locId,
        name: d.name,
        scheduledHours: +d.scheduledHours.toFixed(2),
        laborCost: +d.laborCost.toFixed(2),
        shiftCount: d.shiftCount,
      })),
      byDate: Array.from(byDateMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, d]) => ({
          date,
          laborCost: +d.laborCost.toFixed(2),
          scheduledHours: +d.scheduledHours.toFixed(2),
        })),
    };
  }

  async getKpiRollup(startDate: string, endDate: string, requestingUser?: User) {
    const qb = this.shiftRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.assignments', 'a')
      .leftJoinAndSelect('a.staff', 'staff')
      .leftJoinAndSelect('s.location', 'loc')
      .where('s.date >= :startDate AND s.date <= :endDate', { startDate, endDate });

    if (requestingUser?.role === UserRole.MANAGER) {
      const ids = requestingUser.managedLocations?.map((l) => l.id) ?? ['__none__'];
      qb.andWhere('s.locationId IN (:...ids)', { ids });
    }

    const shifts = await qb.getMany();

    const locMap = new Map<string, {
      name: string;
      timezone: string;
      totalShifts: number;
      publishedShifts: number;
      draftShifts: number;
      totalAssignments: number;
      totalHeadcount: number;
      publishedAssignments: number;
      totalScheduledHours: number;
      estimatedLaborCost: number;
    }>();

    for (const shift of shifts) {
      const locId = shift.locationId;
      let entry = locMap.get(locId);
      if (!entry) {
        entry = {
          name: shift.location?.name ?? locId,
          timezone: shift.location?.timezone ?? 'UTC',
          totalShifts: 0,
          publishedShifts: 0,
          draftShifts: 0,
          totalAssignments: 0,
          totalHeadcount: 0,
          publishedAssignments: 0,
          totalScheduledHours: 0,
          estimatedLaborCost: 0,
        };
        locMap.set(locId, entry);
      }
      entry.totalShifts += 1;

      if (shift.status === ShiftStatus.PUBLISHED) {
        entry.publishedShifts += 1;
        const scheduledHours = minutesBetween(shift.startTime, shift.endTime) / 60;
        entry.totalScheduledHours += scheduledHours;
        entry.totalHeadcount += shift.headcount;

        const activeAssignments = (shift.assignments ?? []).filter(
          (a) => a.status === AssignmentStatus.ASSIGNED || a.status === AssignmentStatus.COMPLETED,
        );
        entry.publishedAssignments += activeAssignments.length;
        entry.totalAssignments += activeAssignments.length;

        entry.estimatedLaborCost += scheduledHours * activeAssignments.reduce((sum, a) => {
          return sum + (a.staff?.hourlyRate ? Number(a.staff.hourlyRate) : 0);
        }, 0);
      } else {
        entry.draftShifts += 1;
        const activeAssignments = (shift.assignments ?? []).filter(
          (a) => a.status === AssignmentStatus.ASSIGNED || a.status === AssignmentStatus.COMPLETED,
        );
        entry.totalAssignments += activeAssignments.length;
      }
    }

    return Array.from(locMap.entries()).map(([locId, d]) => ({
      locationId: locId,
      name: d.name,
      timezone: d.timezone,
      totalShifts: d.totalShifts,
      publishedShifts: d.publishedShifts,
      draftShifts: d.draftShifts,
      totalAssignments: d.totalAssignments,
      totalScheduledHours: +d.totalScheduledHours.toFixed(2),
      estimatedLaborCost: +d.estimatedLaborCost.toFixed(2),
      fillRate: d.totalHeadcount > 0
        ? +(d.publishedAssignments / d.totalHeadcount).toFixed(3)
        : 0,
    })).sort((a, b) => b.totalShifts - a.totalShifts);
  }

  async getAbsenteeism(startDate: string, endDate: string, locationId?: string, requestingUser?: User) {
    const today = new Date().toISOString().split('T')[0];

    const qb = this.assignRepo
      .createQueryBuilder('a')
      .innerJoinAndSelect('a.shift', 's')
      .innerJoinAndSelect('a.staff', 'staff')
      .where('s.status = :status', { status: ShiftStatus.PUBLISHED })
      .andWhere('s.date >= :startDate AND s.date <= :endDate', { startDate, endDate })
      .andWhere('s.date < :today', { today })
      .andWhere('a.status = :assignedStatus', { assignedStatus: AssignmentStatus.ASSIGNED });

    if (locationId) qb.andWhere('s.locationId = :locationId', { locationId });
    if (requestingUser?.role === UserRole.MANAGER) {
      const ids = requestingUser.managedLocations?.map((l) => l.id) ?? ['__none__'];
      qb.andWhere('s.locationId IN (:...ids)', { ids });
    }

    const noShows = await qb.getMany();

    const noShowCount = noShows.length;
    const totalQb = this.assignRepo
      .createQueryBuilder('a')
      .innerJoin('a.shift', 's')
      .where('s.status = :status', { status: ShiftStatus.PUBLISHED })
      .andWhere('s.date >= :startDate AND s.date <= :endDate', { startDate, endDate })
      .andWhere('s.date < :today', { today })
      .andWhere('a.status IN (:...statuses)', {
        statuses: [AssignmentStatus.ASSIGNED, AssignmentStatus.COMPLETED],
      });

    if (locationId) totalQb.andWhere('s.locationId = :locationId', { locationId });
    if (requestingUser?.role === UserRole.MANAGER) {
      const ids = requestingUser.managedLocations?.map((l) => l.id) ?? ['__none__'];
      totalQb.andWhere('s.locationId IN (:...ids)', { ids });
    }

    const totalAssignmentsInRange = await totalQb.getCount();

    const noShowRate = totalAssignmentsInRange > 0
      ? +(noShowCount / totalAssignmentsInRange).toFixed(3)
      : 0;

    // Aggregate by staff
    const byStaffMap = new Map<string, { name: string; noShowCount: number }>();
    const byDateMap = new Map<string, number>();

    for (const a of noShows) {
      const key = a.staffId;
      let staffEntry = byStaffMap.get(key);
      if (!staffEntry) {
        staffEntry = { name: a.staff.name, noShowCount: 0 };
        byStaffMap.set(key, staffEntry);
      }
      staffEntry.noShowCount += 1;

      const date = a.shift.date;
      byDateMap.set(date, (byDateMap.get(date) ?? 0) + 1);
    }

    return {
      noShowCount,
      noShowRate,
      byStaff: Array.from(byStaffMap.entries())
        .map(([staffId, d]) => ({ staffId, name: d.name, noShowCount: d.noShowCount }))
        .sort((a, b) => b.noShowCount - a.noShowCount),
      byDate: Array.from(byDateMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, noShowCount]) => ({ date, noShowCount })),
    };
  }

  async getTurnover() {
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    // All users
    const allUsers = await this.userRepo.find({
      select: ['id', 'isActive', 'createdAt'],
    });

    const totalActive = allUsers.filter((u) => u.isActive).length;
    const totalInactive = allUsers.filter((u) => !u.isActive).length;

    // Hires per month (users created in the last 12 months)
    const hiresByMonthMap = new Map<string, number>();
    for (const user of allUsers) {
      const created = new Date(user.createdAt);
      if (created >= twelveMonthsAgo) {
        const monthKey = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
        hiresByMonthMap.set(monthKey, (hiresByMonthMap.get(monthKey) ?? 0) + 1);
      }
    }

    // Build ordered month list for last 12 months
    const hiresByMonth: Array<{ month: string; count: number }> = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      hiresByMonth.push({ month: monthKey, count: hiresByMonthMap.get(monthKey) ?? 0 });
    }

    // Active staff count by location
    const activeByLocationRaw = await this.userRepo
      .createQueryBuilder('u')
      .innerJoin('u.certifiedLocations', 'loc')
      .select('loc.id', 'locationId')
      .addSelect('loc.name', 'name')
      .addSelect('COUNT(DISTINCT u.id)', 'staffCount')
      .where('u.isActive = :active', { active: true })
      .andWhere('u.role = :role', { role: UserRole.STAFF })
      .groupBy('loc.id')
      .addGroupBy('loc.name')
      .getRawMany<{ locationId: string; name: string; staffCount: string }>();

    const activeByLocation = activeByLocationRaw.map((r) => ({
      locationId: r.locationId,
      name: r.name,
      staffCount: Number(r.staffCount),
    }));

    return {
      totalActive,
      totalInactive,
      hiresByMonth,
      activeByLocation,
    };
  }
}
