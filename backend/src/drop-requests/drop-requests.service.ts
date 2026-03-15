import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DropRequest, DropRequestStatus } from './entities/drop-request.entity';
import {
  ShiftAssignment,
  AssignmentStatus,
} from '../shifts/entities/shift-assignment.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { NotificationType } from '../notifications/entities/notification.entity';
import { ConstraintCheckerService } from '../shifts/constraint-checker.service';
import { shiftToUTCRange } from '../common/timezone.util';
import { CreateDropRequestDto } from './dto/create-drop-request.dto';
import { ReviewDropDto } from './dto/review-drop.dto';

const MAX_PENDING_REQUESTS = 3;

@Injectable()
export class DropRequestsService {
  private readonly logger = new Logger(DropRequestsService.name);

  constructor(
    @InjectRepository(DropRequest) private dropRepo: Repository<DropRequest>,
    @InjectRepository(ShiftAssignment)
    private assignRepo: Repository<ShiftAssignment>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private constraints: ConstraintCheckerService,
    private events: EventEmitter2,
    private dataSource: DataSource,
  ) {}

  private safeEmit(event: string, payload: unknown): void {
    try {
      this.events.emit(event, payload);
    } catch (err) {
      this.logger.error(
        `Event emission failed for "${event}": ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  async findAll(user: User) {
    const qb = this.dropRepo
      .createQueryBuilder('dr')
      .leftJoinAndSelect('dr.assignment', 'a')
      .leftJoinAndSelect('a.shift', 'shift')
      .leftJoinAndSelect('shift.location', 'loc')
      .leftJoinAndSelect('shift.requiredSkill', 'skill')
      .leftJoinAndSelect('a.staff', 'staff')
      .leftJoinAndSelect('dr.claimedBy', 'claimedBy')
      .orderBy('dr.createdAt', 'DESC');

    if (user.role === UserRole.STAFF) {
      qb.where(
        'a.staffId = :uid OR (dr.status = :open AND shift.locationId IN (:...locIds))',
        {
          uid: user.id,
          open: DropRequestStatus.OPEN,
          locIds: user.certifiedLocations?.map((l) => l.id) ?? ['__none__'],
        },
      );
    } else if (user.role === UserRole.MANAGER) {
      const managedIds = user.managedLocations?.map((l) => l.id) ?? [
        '__none__',
      ];
      qb.where('shift.locationId IN (:...managedIds)', { managedIds });
    }

    return qb.take(200).getMany();
  }

  async create(dto: CreateDropRequestDto, requester: User) {
    const pendingCount = await this.dropRepo.count({
      where: {
        assignment: { staffId: requester.id },
        status: DropRequestStatus.OPEN,
      },
    });
    if (pendingCount >= MAX_PENDING_REQUESTS) {
      throw new BadRequestException(
        `Cannot have more than ${MAX_PENDING_REQUESTS} open drop requests.`,
      );
    }

    const assignment = await this.assignRepo.findOne({
      where: {
        id: dto.assignmentId,
        staffId: requester.id,
        status: AssignmentStatus.ASSIGNED,
      },
      relations: ['shift', 'shift.location'],
    });
    if (!assignment)
      throw new NotFoundException('Assignment not found or not yours');
    if (!assignment.shift?.location?.timezone) {
      throw new BadRequestException('Shift location data is unavailable');
    }

    const { startUTC } = shiftToUTCRange(
      assignment.shift.date,
      assignment.shift.startTime,
      assignment.shift.endTime,
      assignment.shift.location.timezone,
    );
    const expiresAt = new Date(startUTC.getTime() - 24 * 3600 * 1000);

    if (expiresAt <= new Date()) {
      throw new BadRequestException(
        'Cannot drop a shift less than 24 hours before it starts.',
      );
    }

    const drop = this.dropRepo.create({
      assignmentId: dto.assignmentId,
      reason: dto.reason ?? null,
      expiresAt,
    });
    const saved = await this.dropRepo.save(drop);

    this.safeEmit('notification.sendToManagers', {
      locationId: assignment.shift.locationId,
      type: NotificationType.DROP_REQUEST_CREATED,
      title: 'Shift Drop Request',
      message: `${requester.name} wants to drop their shift on ${assignment.shift.date}.`,
      entityType: 'drop_request',
      entityId: saved.id,
    });

    this.safeEmit('audit.log', {
      entity: 'drop_request',
      entityId: saved.id,
      action: 'created',
      locationId: assignment.shift.locationId,
      after: dto,
      performedById: requester.id,
    });

    return saved;
  }

  async claim(dropId: string, claimer: User) {
    // Load relations needed for constraint check — outside the lock to avoid holding it during expensive checks
    const drop = await this.findOneOr404(dropId);

    if (drop.assignment.staffId === claimer.id) {
      throw new BadRequestException('You cannot claim your own shift.');
    }

    const fullClaimer = await this.userRepo.findOne({
      where: { id: claimer.id },
      relations: ['skills', 'certifiedLocations'],
    });
    const result = await this.constraints.check(
      drop.assignment.shift,
      fullClaimer!,
    );
    if (!result.valid) {
      throw new BadRequestException({
        message: 'You cannot take this shift',
        violations: result.violations,
      });
    }

    // Pessimistic lock to prevent two users claiming simultaneously
    const saved = await this.dataSource.transaction(async (em) => {
      const locked = await em.findOne(DropRequest, {
        where: { id: dropId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked || locked.status !== DropRequestStatus.OPEN) {
        throw new BadRequestException(
          'This shift is no longer available for pickup.',
        );
      }
      if (locked.expiresAt <= new Date()) {
        throw new BadRequestException('This drop request has expired.');
      }
      locked.claimedById = claimer.id;
      locked.status = DropRequestStatus.CLAIMED;
      return em.save(DropRequest, locked);
    });

    this.safeEmit('notification.sendToManagers', {
      locationId: drop.assignment.shift.locationId,
      type: NotificationType.DROP_REQUEST_CLAIMED,
      title: 'Shift Claimed',
      message: `${claimer.name} wants to pick up ${drop.assignment.staff.name}'s shift on ${drop.assignment.shift.date}. Requires approval.`,
      entityType: 'drop_request',
      entityId: dropId,
    });

    this.safeEmit('audit.log', {
      entity: 'drop_request',
      entityId: dropId,
      action: 'claimed',
      locationId: drop.assignment.shift.locationId,
      performedById: claimer.id,
    });

    return saved;
  }

  async approve(dropId: string, manager: User, dto: ReviewDropDto) {
    const drop = await this.findOneOr404(dropId);
    if (drop.status !== DropRequestStatus.CLAIMED) {
      throw new BadRequestException(
        'No one has claimed this drop request yet.',
      );
    }
    if (!drop.claimedById) {
      throw new BadRequestException('No user has claimed this drop request.');
    }

    if (manager.role === UserRole.MANAGER) {
      const mgr = await this.userRepo.findOne({
        where: { id: manager.id },
        relations: ['managedLocations'],
      });
      const locationId = drop.assignment?.shift?.locationId;
      const manages = mgr?.managedLocations?.some((l) => l.id === locationId);
      if (!manages)
        throw new ForbiddenException('You do not manage this shift location');
    }

    const saved = await this.dataSource.transaction(async (em) => {
      const locked = await em.findOne(DropRequest, {
        where: { id: dropId },
        lock: { mode: 'pessimistic_write' },
        relations: ['assignment', 'assignment.shift'],
      });
      if (
        !locked ||
        locked.status !== DropRequestStatus.CLAIMED ||
        !locked.claimedById
      ) {
        throw new BadRequestException(
          'This drop request is no longer in an approvable state',
        );
      }
      await em.update(ShiftAssignment, locked.assignmentId, {
        status: AssignmentStatus.CANCELLED,
      });
      const newAssignment = em.create(ShiftAssignment, {
        shiftId: locked.assignment.shiftId,
        staffId: locked.claimedById,
        assignedById: manager.id,
      });
      await em.save(ShiftAssignment, newAssignment);
      locked.status = DropRequestStatus.APPROVED;
      locked.managerId = manager.id;
      locked.managerNote = dto.managerNote ?? null;
      locked.reviewedAt = new Date();
      return em.save(DropRequest, locked);
    });

    for (const userId of [drop.assignment.staffId, drop.claimedById]) {
      this.safeEmit('notification.send', {
        userId,
        type: NotificationType.DROP_REQUEST_APPROVED,
        title: 'Shift Transfer Approved',
        message: `The shift transfer has been approved by ${manager.name}.`,
        entityType: 'drop_request',
        entityId: dropId,
      });
    }

    this.safeEmit('schedule.updated', {
      locationId: drop.assignment.shift.locationId,
    });
    this.safeEmit('audit.log', {
      entity: 'drop_request',
      entityId: dropId,
      action: 'approved',
      locationId: drop.assignment.shift.locationId,
      performedById: manager.id,
      note: dto.managerNote,
    });

    return saved;
  }

  async reject(dropId: string, manager: User, dto: ReviewDropDto) {
    const drop = await this.findOneOr404(dropId);
    if (
      ![DropRequestStatus.CLAIMED, DropRequestStatus.OPEN].includes(drop.status)
    ) {
      throw new BadRequestException('Cannot reject this drop request.');
    }

    if (manager.role === UserRole.MANAGER) {
      const mgr = await this.userRepo.findOne({
        where: { id: manager.id },
        relations: ['managedLocations'],
      });
      const locationId = drop.assignment?.shift?.locationId;
      const manages = mgr?.managedLocations?.some((l) => l.id === locationId);
      if (!manages)
        throw new ForbiddenException('You do not manage this shift location');
    }

    const saved = await this.dataSource.transaction(async (em) => {
      drop.status = DropRequestStatus.REJECTED;
      drop.managerId = manager.id;
      drop.managerNote = dto.managerNote ?? null;
      drop.reviewedAt = new Date();
      const savedDrop = await em.save(DropRequest, drop);
      await em.update(ShiftAssignment, drop.assignmentId, {
        status: AssignmentStatus.ASSIGNED,
      });
      return savedDrop;
    });

    const notifyIds = [drop.assignment.staffId];
    if (drop.claimedById) notifyIds.push(drop.claimedById);
    for (const userId of notifyIds) {
      this.safeEmit('notification.send', {
        userId,
        type: NotificationType.DROP_REQUEST_REJECTED,
        title: 'Drop Request Rejected',
        message: `The shift drop/pickup request was rejected by ${manager.name}.`,
        entityType: 'drop_request',
        entityId: dropId,
      });
    }

    this.safeEmit('audit.log', {
      entity: 'drop_request',
      entityId: dropId,
      action: 'rejected',
      locationId: drop.assignment.shift.locationId,
      performedById: manager.id,
      note: saved.managerNote,
    });

    return saved;
  }

  async cancel(dropId: string, user: User) {
    const drop = await this.findOneOr404(dropId);
    if (drop.assignment.staffId !== user.id) throw new ForbiddenException();
    if (
      ![DropRequestStatus.OPEN, DropRequestStatus.CLAIMED].includes(drop.status)
    ) {
      throw new BadRequestException(
        'Can only cancel open or claimed drop requests.',
      );
    }

    const claimedById = drop.claimedById;

    await this.dataSource.transaction(async (em) => {
      drop.status = DropRequestStatus.CANCELLED;
      drop.claimedById = null;
      await em.update(ShiftAssignment, drop.assignmentId, {
        status: AssignmentStatus.ASSIGNED,
      });
      await em.save(DropRequest, drop);
    });

    // Notify the claimer their pickup was withdrawn
    if (claimedById) {
      this.safeEmit('notification.send', {
        userId: claimedById,
        type: NotificationType.DROP_REQUEST_CANCELLED,
        title: 'Pickup Withdrawn',
        message: `The drop request you claimed for the shift on ${drop.assignment.shift.date} was cancelled by the original staff member.`,
        entityType: 'drop_request',
        entityId: dropId,
      });
    }

    return drop;
  }

  @Cron('*/5 * * * *') // every 5 minutes
  async expireDropRequests() {
    const expired = await this.dropRepo
      .createQueryBuilder('dr')
      .leftJoinAndSelect('dr.assignment', 'a')
      .leftJoinAndSelect('a.shift', 'shift')
      .where('dr.status = :open', { open: DropRequestStatus.OPEN })
      .andWhere('dr.expiresAt <= :now', { now: new Date() })
      .getMany();

    for (const drop of expired) {
      drop.status = DropRequestStatus.EXPIRED;
      await this.dropRepo.save(drop);
      await this.assignRepo.update(drop.assignmentId, {
        status: AssignmentStatus.ASSIGNED,
      });

      this.safeEmit('notification.send', {
        userId: drop.assignment.staffId,
        type: NotificationType.DROP_REQUEST_EXPIRED,
        title: 'Drop Request Expired',
        message: `Your drop request for the shift on ${drop.assignment.shift.date} has expired with no one claiming it.`,
        entityType: 'drop_request',
        entityId: drop.id,
      });
    }
  }

  private async findOneOr404(id: string) {
    const drop = await this.dropRepo.findOne({
      where: { id },
      relations: [
        'assignment',
        'assignment.shift',
        'assignment.shift.location',
        'assignment.staff',
        'claimedBy',
      ],
    });
    if (!drop) throw new NotFoundException('Drop request not found');
    return drop;
  }
}
