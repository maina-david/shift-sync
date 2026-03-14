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
import { SwapRequest, SwapRequestStatus } from '../swap-requests/entities/swap-request.entity';
import { ConstraintCheckerService } from './constraint-checker.service';
import { CreateShiftDto } from './dto/create-shift.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';
import { AssignStaffDto } from './dto/assign-staff.dto';
import { PublishWeekDto } from './dto/publish-week.dto';
import { addDays, weekStart, shiftToUTCRange } from '../common/timezone.util';
import { UsersService } from '../users/users.service';

@Injectable()
export class ShiftsService {
  private readonly logger = new Logger(ShiftsService.name);

  constructor(
    @InjectRepository(Shift) private shiftRepo: Repository<Shift>,
    @InjectRepository(ShiftAssignment) private assignRepo: Repository<ShiftAssignment>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private constraints: ConstraintCheckerService,
    private usersService: UsersService,
    private events: EventEmitter2,
    private dataSource: DataSource,
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
  }) {
    const qb = this.shiftRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.assignments', 'a')
      .leftJoinAndSelect('a.staff', 'staff')
      .leftJoinAndSelect('s.location', 'location')
      .leftJoinAndSelect('s.requiredSkill', 'skill')
      .orderBy('s.date', 'ASC')
      .addOrderBy('s.startTime', 'ASC');

    if (options.locationId) {
      qb.andWhere('s.locationId = :locationId', { locationId: options.locationId });
    }

    if (options.requestingUser.role === UserRole.MANAGER) {
      const managedIds = options.requestingUser.managedLocations?.map((l) => l.id) ?? [];
      if (managedIds.length === 0) return [];
      qb.andWhere('s.locationId IN (:...managedIds)', { managedIds });
    }

    if (options.requestingUser.role === UserRole.STAFF) {
      const certifiedIds = options.requestingUser.certifiedLocations?.map((l) => l.id) ?? [];
      if (certifiedIds.length === 0) return [];
      qb.andWhere('s.locationId IN (:...certifiedIds)', { certifiedIds });
      qb.andWhere('s.status = :pub', { pub: ShiftStatus.PUBLISHED });
    }

    if (options.startDate) qb.andWhere('s.date >= :startDate', { startDate: options.startDate });
    if (options.endDate) qb.andWhere('s.date <= :endDate', { endDate: options.endDate });
    if (options.status) qb.andWhere('s.status = :status', { status: options.status });

    return qb.getMany();
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
    await this.shiftRepo.remove(shift);
    this.safeEmit('schedule.updated', { locationId });
  }

  async publish(id: string, manager: User) {
    const shift = await this.findOne(id);
    this.assertCanManage(shift, manager);
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
    const sourceShifts = await this.shiftRepo.find({
      where: {
        locationId,
        date: Between(sourceWeekStart, sourceEnd),
      },
    });

    if (sourceShifts.length === 0) {
      throw new BadRequestException('No shifts found in source week');
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

    if (constraintResult.warnings.some((w) => w.rule === 'weekly_hours')) {
      this.safeEmit('notification.send', {
        userId: manager.id,
        type: 'OVERTIME_WARNING',
        title: 'Overtime Warning',
        message: constraintResult.warnings.find((w) => w.rule === 'weekly_hours')!.message,
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
