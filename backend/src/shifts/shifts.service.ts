import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, Between, In } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Shift, ShiftStatus } from './entities/shift.entity';
import { ShiftAssignment, AssignmentStatus } from './entities/shift-assignment.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { Availability } from '../users/entities/availability.entity';
import { SwapRequest, SwapRequestStatus } from '../swap-requests/entities/swap-request.entity';
import { ConstraintCheckerService } from './constraint-checker.service';
import { CreateShiftDto } from './dto/create-shift.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';
import { AssignStaffDto } from './dto/assign-staff.dto';
import { PublishWeekDto } from './dto/publish-week.dto';
import { addDays, weekStart, shiftToUTCRange, minutesBetween } from '../common/timezone.util';
import { UsersService } from '../users/users.service';
import { SettingsService } from '../settings/settings.service';
import { AutoScheduleDto } from './dto/auto-schedule.dto';

@Injectable()
export class ShiftsService {
  private readonly logger = new Logger(ShiftsService.name);

  constructor(
    @InjectRepository(Shift) private shiftRepo: Repository<Shift>,
    @InjectRepository(ShiftAssignment) private assignRepo: Repository<ShiftAssignment>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Availability) private availRepo: Repository<Availability>,
    private constraints: ConstraintCheckerService,
    private usersService: UsersService,
    private events: EventEmitter2,
    private dataSource: DataSource,
    private settingsService: SettingsService,
  ) {}

  private safeEmit(event: string, payload: unknown): void {
    try {
      this.events.emit(event, payload);
    } catch (err) {
      this.logger.error(`Event emission failed for "${event}": ${(err as Error).message}`, (err as Error).stack);
    }
  }

  async findAll(options: {
    locationId?: string;
    startDate?: string;
    endDate?: string;
    status?: ShiftStatus;
    requestingUser: User;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(options.limit ?? 100, 200);

    const qb = this.shiftRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.assignments', 'a')
      .leftJoinAndSelect('a.staff', 'staff')
      .leftJoinAndSelect('s.location', 'location')
      .leftJoinAndSelect('s.requiredSkill', 'skill')
      .orderBy('s.date', 'ASC')
      .addOrderBy('s.startTime', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    if (options.locationId) {
      qb.andWhere('s.locationId = :locationId', { locationId: options.locationId });
    }

    if (options.requestingUser.role === UserRole.MANAGER) {
      const managedIds = options.requestingUser.managedLocations?.map((l) => l.id) ?? [];
      if (managedIds.length === 0) return { data: [], total: 0, page, limit };
      qb.andWhere('s.locationId IN (:...managedIds)', { managedIds });
    }

    if (options.requestingUser.role === UserRole.STAFF) {
      const certifiedIds = options.requestingUser.certifiedLocations?.map((l) => l.id) ?? [];
      if (certifiedIds.length === 0) return { data: [], total: 0, page, limit };
      qb.andWhere('s.locationId IN (:...certifiedIds)', { certifiedIds });
      qb.andWhere('s.status = :pub', { pub: ShiftStatus.PUBLISHED });
    }

    if (options.startDate) qb.andWhere('s.date >= :startDate', { startDate: options.startDate });
    if (options.endDate) qb.andWhere('s.date <= :endDate', { endDate: options.endDate });
    if (options.status) qb.andWhere('s.status = :status', { status: options.status });

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const shift = await this.shiftRepo.findOne({
      where: { id },
      relations: ['assignments', 'assignments.staff', 'assignments.assignedBy', 'location', 'requiredSkill', 'publishedBy'],
    });
    if (!shift) throw new NotFoundException('Shift not found');
    return shift;
  }

  async create(dto: CreateShiftDto, manager: User) {
    if (manager.role === UserRole.MANAGER) {
      const manages = manager.managedLocations?.some((l) => l.id === dto.locationId);
      if (!manages) throw new ForbiddenException('You do not manage this location');
    }

    const isOvernight = dto.endTime < dto.startTime;
    const shift = this.shiftRepo.create({
      ...dto,
      requiredSkillId: dto.requiredSkillId ?? null,
      headcount: dto.headcount ?? 1,
      isOvernight,
    });
    const saved = await this.shiftRepo.save(shift);
    this.safeEmit('schedule.updated', { shiftId: saved.id, locationId: saved.locationId });
    return this.findOne(saved.id);
  }

  async update(id: string, dto: UpdateShiftDto, manager: User) {
    const shift = await this.findOne(id);
    this.assertCanManage(shift, manager);

    const CUTOFF_HOURS = 48;
    if (shift.status === ShiftStatus.PUBLISHED) {
      const shiftStart = new Date(`${shift.date}T${shift.startTime}:00`);
      const hoursUntil = (shiftStart.getTime() - Date.now()) / 3600000;
      if (hoursUntil < CUTOFF_HOURS) {
        throw new BadRequestException(
          `Cannot edit a published shift within ${CUTOFF_HOURS}h of its start time.`,
        );
      }
    }

    Object.assign(shift, dto);

    // Guard after merging so we compare resolved values (not just DTO values).
    // The DTO-level @IsNotSameAs only catches same-request pairs; this catches
    // the partial-update case where only one time field is sent but they collide with the DB value.
    if (shift.startTime === shift.endTime) {
      throw new BadRequestException('startTime and endTime must not be equal');
    }

    if (dto.startTime || dto.endTime) {
      shift.isOvernight = (dto.endTime ?? shift.endTime) < (dto.startTime ?? shift.startTime);
    }

    const assignmentIds = shift.assignments.map((a) => a.id);
    let cancelledSwaps: SwapRequest[] = [];

    const saved = await this.dataSource.transaction(async (em) => {
      const savedShift = await em.save(Shift, shift);

      if (assignmentIds.length > 0) {
        const pendingSwaps = await em.find(SwapRequest, {
          where: { fromAssignmentId: In(assignmentIds), status: SwapRequestStatus.PENDING },
          relations: ['fromAssignment', 'toUser'],
        });
        for (const swap of pendingSwaps) {
          swap.status = SwapRequestStatus.CANCELLED;
          await em.save(SwapRequest, swap);
        }
        cancelledSwaps = pendingSwaps;
      }

      return savedShift;
    });

    for (const swap of cancelledSwaps) {
      this.safeEmit('notification.send', {
        userId: swap.fromAssignment.staffId,
        type: 'SWAP_CANCELLED_SHIFT_EDIT',
        title: 'Swap Cancelled',
        message: `Your swap request was cancelled because the shift was edited.`,
        entityType: 'swap_request',
        entityId: swap.id,
      });
      this.safeEmit('notification.send', {
        userId: swap.toUserId,
        type: 'SWAP_CANCELLED_SHIFT_EDIT',
        title: 'Swap Cancelled',
        message: `A pending swap request was cancelled because the shift was edited.`,
        entityType: 'swap_request',
        entityId: swap.id,
      });
    }

    this.safeEmit('schedule.updated', { shiftId: saved.id, locationId: saved.locationId });
    return this.findOne(saved.id);
  }

  async remove(id: string, manager: User) {
    const shift = await this.findOne(id);
    this.assertCanManage(shift, manager);
    const locationId = shift.locationId;
    await this.shiftRepo.softRemove(shift);
    this.safeEmit('schedule.updated', { locationId });
  }

  async publish(id: string, manager: User) {
    const shift = await this.findOne(id);
    this.assertCanManage(shift, manager);
    if (shift.status === ShiftStatus.PUBLISHED) {
      return this.findOne(id);
    }
    shift.status = ShiftStatus.PUBLISHED;
    shift.publishedAt = new Date();
    shift.publishedById = manager.id;
    const saved = await this.shiftRepo.save(shift);

    for (const assignment of shift.assignments) {
      this.safeEmit('notification.send', {
        userId: assignment.staffId,
        type: 'SCHEDULE_PUBLISHED',
        title: 'Schedule Published',
        message: `Your shift on ${shift.date} at ${shift.location.name} (${shift.startTime}–${shift.endTime}) has been published.`,
        entityType: 'shift',
        entityId: shift.id,
      });
    }

    this.safeEmit('schedule.updated', { shiftId: saved.id, locationId: saved.locationId });
    return this.findOne(saved.id);
  }

  async publishWeek(dto: PublishWeekDto, manager: User) {
    if (manager.role === UserRole.MANAGER) {
      const manages = manager.managedLocations?.some((l) => l.id === dto.locationId);
      if (!manages) throw new ForbiddenException('You do not manage this location');
    }

    const weekEnd = addDays(dto.weekStart, 7);
    const shifts = await this.shiftRepo.find({
      where: {
        locationId: dto.locationId,
        status: ShiftStatus.DRAFT,
        date: Between(dto.weekStart, weekEnd),
      },
      relations: ['assignments', 'location'],
    });

    for (const shift of shifts) {
      shift.status = ShiftStatus.PUBLISHED;
      shift.publishedAt = new Date();
      shift.publishedById = manager.id;
    }
    await this.shiftRepo.save(shifts);

    const staffIds = new Set(shifts.flatMap((s) => s.assignments.map((a) => a.staffId)));
    for (const staffId of staffIds) {
      this.safeEmit('notification.send', {
        userId: staffId,
        type: 'SCHEDULE_PUBLISHED',
        title: 'Schedule Published',
        message: `The schedule for the week of ${dto.weekStart} at your location has been published.`,
        entityType: 'location',
        entityId: dto.locationId,
      });
    }

    this.safeEmit('schedule.updated', { locationId: dto.locationId, weekStart: dto.weekStart });
    return { published: shifts.length };
  }

  async copyWeek(
    sourceWeekStart: string,
    targetWeekStart: string,
    locationId: string,
    manager: User,
  ) {
    if (manager.role !== UserRole.ADMIN && manager.role !== UserRole.MANAGER) {
      throw new ForbiddenException();
    }
    if (manager.role === UserRole.MANAGER) {
      const manages = manager.managedLocations?.some((l) => l.id === locationId);
      if (!manages) throw new ForbiddenException('You do not manage this location');
    }

    const sourceEnd = addDays(sourceWeekStart, 7);
    const targetEnd = addDays(targetWeekStart, 7);

    const [sourceShifts, existingCount] = await Promise.all([
      this.shiftRepo.find({
        where: { locationId, date: Between(sourceWeekStart, sourceEnd) },
      }),
      this.shiftRepo.count({
        where: { locationId, date: Between(targetWeekStart, targetEnd) },
      }),
    ]);

    if (sourceShifts.length === 0) {
      throw new BadRequestException('No shifts found in source week');
    }

    if (existingCount > 0) {
      throw new BadRequestException('Target week already has shifts. Delete them first or choose a different target week.');
    }

    const dayOffset =
      (new Date(targetWeekStart).getTime() - new Date(sourceWeekStart).getTime()) /
      86400000;

    const newShifts = sourceShifts.map((s) => {
      const newDate = addDays(s.date, dayOffset);
      return this.shiftRepo.create({
        locationId: s.locationId,
        date: newDate,
        startTime: s.startTime,
        endTime: s.endTime,
        ...(s.requiredSkillId ? { requiredSkillId: s.requiredSkillId } : {}),
        headcount: s.headcount,
        notes: s.notes,
        isOvernight: s.isOvernight,
        status: ShiftStatus.DRAFT,
      });
    });

    await this.shiftRepo.save(newShifts);
    this.safeEmit('schedule.updated', { locationId });
    return { copied: newShifts.length };
  }

  async unpublish(id: string, manager: User) {
    const shift = await this.findOne(id);
    this.assertCanManage(shift, manager);
    if (shift.status !== ShiftStatus.PUBLISHED) {
      throw new BadRequestException('Only published shifts can be unpublished');
    }

    const CUTOFF_HOURS = 48;
    const shiftStart = new Date(`${shift.date}T${shift.startTime}:00`);
    const hoursUntil = (shiftStart.getTime() - Date.now()) / 3600000;
    if (hoursUntil < CUTOFF_HOURS) {
      throw new BadRequestException(`Cannot unpublish within ${CUTOFF_HOURS}h of shift start.`);
    }

    shift.status = ShiftStatus.DRAFT;
    shift.publishedAt = null;
    const saved = await this.shiftRepo.save(shift);
    this.safeEmit('schedule.updated', { shiftId: saved.id, locationId: saved.locationId });
    return saved;
  }

  async validateAssignment(shiftId: string, dto: AssignStaffDto, requestingUser: User) {
    const shift = await this.findOne(shiftId);
    this.assertCanManage(shift, requestingUser);
    const staff = await this.userRepo.findOne({
      where: { id: dto.staffId },
      relations: ['skills', 'certifiedLocations', 'managedLocations'],
    });
    if (!staff) throw new NotFoundException('Staff member not found');

    const result = await this.constraints.check(shift, staff, dto.overrideReason);

    let alternatives: { id: string; name: string }[] = [];
    if (!result.valid) {
      const qualified = await this.usersService.findQualifiedForShift(
        shift.requiredSkillId,
        shift.locationId,
        [dto.staffId],
      );
      alternatives = qualified.slice(0, 5).map((u) => ({ id: u.id, name: u.name }));
    }

    return { ...result, alternatives };
  }

  async assignStaff(shiftId: string, dto: AssignStaffDto, manager: User) {
    const shift = await this.findOne(shiftId);
    this.assertCanManage(shift, manager);

    const currentCount = shift.assignments.filter(
      (a) => a.status === AssignmentStatus.ASSIGNED || a.status === AssignmentStatus.PENDING_SWAP,
    ).length;
    if (currentCount >= shift.headcount) {
      throw new BadRequestException(`Shift is already fully staffed (${shift.headcount} needed).`);
    }

    const already = shift.assignments.find(
      (a) => a.staffId === dto.staffId && a.status !== AssignmentStatus.CANCELLED,
    );
    if (already) throw new BadRequestException('Staff member is already assigned to this shift.');

    const staff = await this.userRepo.findOne({
      where: { id: dto.staffId },
      relations: ['skills', 'certifiedLocations'],
    });
    if (!staff) throw new NotFoundException('Staff member not found');

    const constraintResult = await this.constraints.check(shift, staff, dto.overrideReason);
    if (!constraintResult.valid) {
      throw new BadRequestException({
        message: 'Assignment violates scheduling constraints',
        violations: constraintResult.violations,
        warnings: constraintResult.warnings,
      });
    }

    // Pessimistic write lock prevents two managers assigning the same slot simultaneously.
    // Pre-checks above run without a lock for good UX; this final critical section
    // re-validates under the lock so only one request wins the race.
    const saved = await this.dataSource.transaction(async (em) => {
      const locked = await em.findOne(Shift, {
        where: { id: shiftId },
        relations: ['assignments'],
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) throw new NotFoundException('Shift not found');

      const lockedCount = locked.assignments.filter(
        (a) => a.status === AssignmentStatus.ASSIGNED || a.status === AssignmentStatus.PENDING_SWAP,
      ).length;
      if (lockedCount >= locked.headcount) {
        this.safeEmit('assignment.conflict', {
          locationId: shift.locationId,
          shiftId,
          staffId: dto.staffId,
          message: `${staff.name} could not be assigned — the shift was just filled by another manager.`,
        });
        throw new BadRequestException(`Shift is already fully staffed (${locked.headcount} needed).`);
      }

      const dup = locked.assignments.find(
        (a) => a.staffId === dto.staffId && a.status !== AssignmentStatus.CANCELLED,
      );
      if (dup) {
        this.safeEmit('assignment.conflict', {
          locationId: shift.locationId,
          shiftId,
          staffId: dto.staffId,
          message: `${staff.name} was simultaneously assigned to this shift by another manager.`,
        });
        throw new BadRequestException('Staff member is already assigned to this shift.');
      }

      const assignment = em.create(ShiftAssignment, {
        shiftId,
        staffId: dto.staffId,
        assignedById: manager.id,
      });
      return em.save(ShiftAssignment, assignment);
    });

    this.safeEmit('audit.log', {
      entity: 'shift_assignment',
      entityId: saved.id,
      action: dto.overrideReason ? 'assigned_with_override' : 'assigned',
      locationId: shift.locationId,
      after: { shiftId, staffId: dto.staffId },
      performedById: manager.id,
      note: dto.overrideReason,
    });

    this.safeEmit('notification.send', {
      userId: dto.staffId,
      type: 'SHIFT_ASSIGNED',
      title: 'New Shift Assigned',
      message: `You have been assigned a shift on ${shift.date} at ${shift.location.name} (${shift.startTime}–${shift.endTime}).`,
      entityType: 'shift',
      entityId: shiftId,
    });

    const overtimeWarning = constraintResult.warnings.find((w) => w.rule === 'weekly_hours');
    if (overtimeWarning) {
      this.safeEmit('notification.send', {
        userId: manager.id,
        type: 'OVERTIME_WARNING',
        title: 'Overtime Warning',
        message: overtimeWarning.message,
        entityType: 'shift_assignment',
        entityId: saved.id,
      });
    }

    this.safeEmit('schedule.updated', { shiftId, locationId: shift.locationId });
    return saved;
  }

  async removeAssignment(shiftId: string, assignmentId: string, manager: User) {
    const shift = await this.findOne(shiftId);
    this.assertCanManage(shift, manager);

    const assignment = await this.assignRepo.findOne({ where: { id: assignmentId, shiftId } });
    if (!assignment) throw new NotFoundException('Assignment not found');

    assignment.status = AssignmentStatus.CANCELLED;
    const saved = await this.assignRepo.save(assignment);

    this.safeEmit('audit.log', {
      entity: 'shift_assignment',
      entityId: assignmentId,
      action: 'removed',
      locationId: shift.locationId,
      before: { shiftId, staffId: assignment.staffId },
      performedById: manager.id,
    });

    this.safeEmit('notification.send', {
      userId: assignment.staffId,
      type: 'SHIFT_CANCELLED',
      title: 'Shift Assignment Removed',
      message: `Your assignment for the shift on ${shift.date} at ${shift.location.name} has been removed.`,
      entityType: 'shift',
      entityId: shiftId,
    });

    this.safeEmit('schedule.updated', { shiftId, locationId: shift.locationId });
    return saved;
  }

  async confirmAssignment(shiftId: string, assignmentId: string, staff: User) {
    const assignment = await this.assignRepo.findOne({ where: { id: assignmentId, shiftId } });
    if (!assignment) throw new NotFoundException('Assignment not found');
    if (assignment.staffId !== staff.id) throw new ForbiddenException('Not your assignment');
    if (assignment.confirmedAt) return assignment; // Already confirmed — idempotent
    assignment.confirmedAt = new Date();
    return this.assignRepo.save(assignment);
  }

  async availableForPickup(staff: User) {
    const certifiedIds = staff.certifiedLocations?.map((l) => l.id) ?? [];
    if (certifiedIds.length === 0) return [];

    const [shifts, existingAssignments] = await Promise.all([
      this.shiftRepo
        .createQueryBuilder('s')
        .leftJoinAndSelect('s.assignments', 'a', 'a.status IN (:...statuses)', {
          statuses: [AssignmentStatus.ASSIGNED, AssignmentStatus.PENDING_SWAP],
        })
        .innerJoinAndSelect('s.location', 'loc')
        .leftJoinAndSelect('s.requiredSkill', 'skill')
        .where('s.locationId IN (:...certifiedIds)', { certifiedIds })
        .andWhere('s.status = :pub', { pub: ShiftStatus.PUBLISHED })
        .andWhere('s.date >= :today', { today: new Date().toISOString().slice(0, 10) })
        .getMany(),
      this.assignRepo
        .createQueryBuilder('a')
        .innerJoinAndSelect('a.shift', 'shift')
        .innerJoinAndSelect('shift.location', 'location')
        .where('a.staffId = :staffId', { staffId: staff.id })
        .andWhere('a.status IN (:...statuses)', {
          statuses: [AssignmentStatus.ASSIGNED, AssignmentStatus.PENDING_SWAP],
        })
        .getMany(),
    ]);

    const existingRanges = existingAssignments.map((a) =>
      shiftToUTCRange(a.shift.date, a.shift.startTime, a.shift.endTime, a.shift.location.timezone),
    );
    const MIN_REST_MS = 10 * 60 * 60 * 1000;

    return shifts.filter((s) => {
      if (s.assignments.length >= s.headcount) return false;
      if (s.assignments.some((a) => a.staffId === staff.id)) return false;
      if (s.requiredSkillId && !staff.skills?.some((sk) => sk.id === s.requiredSkillId)) return false;

      const { startUTC, endUTC } = shiftToUTCRange(s.date, s.startTime, s.endTime, s.location.timezone);
      for (const { startUTC: exStart, endUTC: exEnd } of existingRanges) {
        if (startUTC < exEnd && endUTC > exStart) return false;
        if (startUTC >= exEnd && startUTC.getTime() - exEnd.getTime() < MIN_REST_MS) return false;
        if (exStart >= endUTC && exStart.getTime() - endUTC.getTime() < MIN_REST_MS) return false;
      }
      return true;
    });
  }

  async onDutyNow(requestingUser: User) {
    const now = new Date();
    const todayDate = now.toISOString().slice(0, 10);
    const yesterdayDate = addDays(todayDate, -1);

    // Fetch shifts for today AND yesterday (overnight shifts from yesterday still active now)
    const qb = this.shiftRepo
      .createQueryBuilder('s')
      .innerJoinAndSelect('s.assignments', 'a')
      .innerJoinAndSelect('a.staff', 'staff')
      .innerJoinAndSelect('s.location', 'loc')
      .where('s.date IN (:...dates)', { dates: [todayDate, yesterdayDate] })
      .andWhere('s.status = :pub', { pub: ShiftStatus.PUBLISHED })
      .andWhere('a.status = :status', { status: AssignmentStatus.ASSIGNED });

    if (requestingUser.role === UserRole.MANAGER) {
      const ids = requestingUser.managedLocations?.map((l) => l.id) ?? ['__none__'];
      qb.andWhere('s.locationId IN (:...ids)', { ids });
    }

    const shifts = await qb.getMany();

    // Filter in-memory using proper timezone-aware UTC range comparison
    return shifts.filter((s) => {
      const { startUTC, endUTC } = shiftToUTCRange(
        s.date,
        s.startTime,
        s.endTime,
        s.location.timezone,
      );
      return now.getTime() >= startUTC.getTime() && now.getTime() < endUTC.getTime();
    });
  }

  /**
   * Cross-location staffing: find staff certified at the given location
   * who are available on the given date (dayOfWeek match) and are NOT
   * already assigned to any shift that day at any location.
   */
  async getCrossLocationAvailable(locationId: string, date: string): Promise<User[]> {
    // 1. Find all users certified at the target location
    const certifiedStaff = await this.userRepo
      .createQueryBuilder('u')
      .innerJoin('u.certifiedLocations', 'loc', 'loc.id = :locationId', { locationId })
      .leftJoinAndSelect('u.availabilities', 'avail')
      .where('u.isActive = :active', { active: true })
      .andWhere('u.role = :role', { role: UserRole.STAFF })
      .getMany();

    if (certifiedStaff.length === 0) return [];

    // 2. Determine the day of week for the target date (0=Sun … 6=Sat)
    const targetDow = new Date(date + 'T00:00:00Z').getUTCDay();

    // 3. Find all staff already assigned to a shift on this date (any location)
    const assignedOnDate = await this.assignRepo
      .createQueryBuilder('a')
      .innerJoin('a.shift', 's')
      .select('a.staffId', 'staffId')
      .where('s.date = :date', { date })
      .andWhere('a.status IN (:...statuses)', {
        statuses: [AssignmentStatus.ASSIGNED, AssignmentStatus.PENDING_SWAP],
      })
      .getRawMany<{ staffId: string }>();

    const assignedIds = new Set(assignedOnDate.map((r) => r.staffId));

    // 4. Filter: not already assigned that day AND has availability for that dayOfWeek
    return certifiedStaff.filter((u) => {
      if (assignedIds.has(u.id)) return false;
      // If the user has no availability records at all, treat them as available
      if (!u.availabilities || u.availabilities.length === 0) return true;
      return u.availabilities.some((av) => av.dayOfWeek === targetDow);
    });
  }

  async autoSchedule(dto: AutoScheduleDto, requesterId: string) {
    const { locationId, weekStart: wkStart } = dto;
    const slotsPerDay = dto.shiftsPerDay ?? 3;
    const minStaff = dto.minStaffPerShift ?? 1;

    // Scheduling settings — used to enforce weeklyOvertimeHours cap
    const s = this.settingsService.getScheduling();

    // Default time slots for each day
    const DEFAULT_SLOTS: { startTime: string; endTime: string }[] = [
      { startTime: '08:00', endTime: '16:00' },
      { startTime: '12:00', endTime: '20:00' },
      { startTime: '17:00', endTime: '23:00' },
    ];
    const slots = DEFAULT_SLOTS.slice(0, slotsPerDay);

    // 1. Fetch all active STAFF certified at locationId with their availabilities
    const certifiedStaff = await this.userRepo
      .createQueryBuilder('u')
      .innerJoin('u.certifiedLocations', 'loc', 'loc.id = :locationId', { locationId })
      .leftJoinAndSelect('u.availabilities', 'avail')
      .where('u.isActive = :active', { active: true })
      .andWhere('u.role = :role', { role: 'staff' })
      .getMany();

    // Pre-fetch all existing assignments in the target week for these staff members
    // to avoid N+1 queries inside the day/slot loops.
    const weekEnd = addDays(wkStart, 7);
    const staffIds = certifiedStaff.map((u) => u.id);

    type RawAssignment = { staffId: string; date: string; startTime: string; endTime: string };
    let weekAssignments: RawAssignment[] = [];
    if (staffIds.length > 0) {
      weekAssignments = await this.assignRepo
        .createQueryBuilder('a')
        .innerJoin('a.shift', 's')
        .select([
          'a.staffId   AS "staffId"',
          's.date      AS "date"',
          's.startTime AS "startTime"',
          's.endTime   AS "endTime"',
        ])
        .where('a.staffId IN (:...staffIds)', { staffIds })
        .andWhere('s.date >= :wkStart', { wkStart })
        .andWhere('s.date < :weekEnd', { weekEnd })
        .andWhere('a.status IN (:...statuses)', {
          statuses: [AssignmentStatus.ASSIGNED, AssignmentStatus.PENDING_SWAP],
        })
        .getRawMany<RawAssignment>();
    }

    // Build per-staff weekly-hours map (minutes → hours when needed)
    const weeklyMinutesMap = new Map<string, number>();
    for (const u of certifiedStaff) weeklyMinutesMap.set(u.id, 0);
    for (const row of weekAssignments) {
      const mins = minutesBetween(row.startTime, row.endTime);
      weeklyMinutesMap.set(row.staffId, (weeklyMinutesMap.get(row.staffId) ?? 0) + mins);
    }

    // Build per-staff per-date assignment set (to detect same-day conflicts)
    const assignedDates = new Map<string, Set<string>>(); // staffId → Set<date>
    for (const row of weekAssignments) {
      if (!assignedDates.has(row.staffId)) assignedDates.set(row.staffId, new Set());
      assignedDates.get(row.staffId)!.add(row.date);
    }

    const unfilledSlots: { date: string; startTime: string; endTime: string; reason: string }[] = [];

    // 2. Plan all slots before writing — collect what would be created
    type PlannedSlot = {
      date: string; startTime: string; endTime: string; headcount: number;
      isOvernight: boolean; staffIds: string[];
    };
    const plannedSlots: PlannedSlot[] = [];

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const date = addDays(wkStart, dayOffset);
      const dow = new Date(date + 'T00:00:00Z').getUTCDay();

      for (const slot of slots) {
        const slotMinutes = minutesBetween(slot.startTime, slot.endTime);

        const candidates = certifiedStaff.filter((u) => {
          if (u.availabilities && u.availabilities.length > 0) {
            const avail = u.availabilities.find((av) => av.dayOfWeek === dow);
            if (!avail) return false;
            const [avSH, avSM] = avail.startTime.split(':').map(Number);
            const [avEH, avEM] = avail.endTime.split(':').map(Number);
            const [slotSH, slotSM] = slot.startTime.split(':').map(Number);
            const [slotEH, slotEM] = slot.endTime.split(':').map(Number);
            const availStart = avSH * 60 + avSM;
            const availEnd = avEH * 60 + avEM;
            const slotStart = slotSH * 60 + slotSM;
            const slotEnd = slotEH * 60 + slotEM;
            if (slotStart < availStart || slotEnd > availEnd) return false;
          }
          if (assignedDates.get(u.id)?.has(date)) return false;
          const currentHours = (weeklyMinutesMap.get(u.id) ?? 0) / 60;
          if (currentHours + slotMinutes / 60 > s.weeklyOvertimeHours) return false;
          return true;
        });

        if (candidates.length === 0) {
          unfilledSlots.push({ date, startTime: slot.startTime, endTime: slot.endTime, reason: 'No eligible staff available for this slot' });
          continue;
        }

        candidates.sort((a, b) => {
          const hoursA = (weeklyMinutesMap.get(a.id) ?? 0) / 60;
          const hoursB = (weeklyMinutesMap.get(b.id) ?? 0) / 60;
          if (hoursA !== hoursB) return hoursA - hoursB;
          return a.name.localeCompare(b.name);
        });

        const picks = candidates.slice(0, Math.min(minStaff, candidates.length));

        if (picks.length < minStaff) {
          unfilledSlots.push({ date, startTime: slot.startTime, endTime: slot.endTime, reason: `Only ${picks.length} of ${minStaff} required staff available` });
        }

        plannedSlots.push({
          date, startTime: slot.startTime, endTime: slot.endTime,
          headcount: picks.length, isOvernight: slot.endTime < slot.startTime,
          staffIds: picks.map((p) => p.id),
        });

        // Update in-memory tracking so subsequent slots reflect the new load
        for (const staff of picks) {
          weeklyMinutesMap.set(staff.id, (weeklyMinutesMap.get(staff.id) ?? 0) + slotMinutes);
          if (!assignedDates.has(staff.id)) assignedDates.set(staff.id, new Set());
          assignedDates.get(staff.id)!.add(date);
        }
      }
    }

    // 3. Persist all planned shifts and assignments in a single transaction
    const { createdShifts, createdAssignments } = await this.dataSource.transaction(async (em) => {
      const shifts: Shift[] = [];
      const assignments: ShiftAssignment[] = [];

      for (const plan of plannedSlots) {
        const shift = em.create(Shift, {
          locationId, date: plan.date, startTime: plan.startTime, endTime: plan.endTime,
          headcount: plan.headcount, isOvernight: plan.isOvernight,
          status: ShiftStatus.DRAFT, notes: 'Auto-generated draft',
        });
        const savedShift = await em.save(Shift, shift);
        shifts.push(savedShift);

        for (const staffId of plan.staffIds) {
          const assignment = em.create(ShiftAssignment, { shiftId: savedShift.id, staffId, assignedById: requesterId });
          const savedAssignment = await em.save(ShiftAssignment, assignment);
          assignments.push(savedAssignment);
        }
      }

      return { createdShifts: shifts, createdAssignments: assignments };
    });

    this.safeEmit('schedule.updated', { locationId, weekStart: wkStart });

    return {
      shiftsCreated: createdShifts.length,
      assignmentsCreated: createdAssignments.length,
      shifts: createdShifts,
      unfilledSlots,
    };
  }

  private assertCanManage(shift: Shift, user: User) {
    if (user.role === UserRole.ADMIN) return;
    if (user.role === UserRole.MANAGER) {
      const manages = user.managedLocations?.some((l) => l.id === shift.locationId);
      if (!manages) throw new ForbiddenException('You do not manage this location');
    } else {
      throw new ForbiddenException('Insufficient permissions');
    }
  }
}
