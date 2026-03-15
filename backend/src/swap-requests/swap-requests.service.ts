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
import { SwapRequest, SwapRequestStatus } from './entities/swap-request.entity';
import {
  ShiftAssignment,
  AssignmentStatus,
} from '../shifts/entities/shift-assignment.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { ConstraintCheckerService } from '../shifts/constraint-checker.service';
import { shiftToUTCRange } from '../common/timezone.util';
import { NotificationType } from '../notifications/entities/notification.entity';
import { CreateSwapRequestDto } from './dto/create-swap-request.dto';
import { ReviewSwapDto } from './dto/review-swap.dto';

const MAX_PENDING_REQUESTS = 3;

@Injectable()
export class SwapRequestsService {
  private readonly logger = new Logger(SwapRequestsService.name);

  constructor(
    @InjectRepository(SwapRequest) private swapRepo: Repository<SwapRequest>,
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

  async findAll(user: User, limit = 50, offset = 0) {
    const take = Math.min(limit, 100);
    const qb = this.swapRepo
      .createQueryBuilder('sr')
      .leftJoinAndSelect('sr.fromAssignment', 'fa')
      .leftJoinAndSelect('fa.shift', 'shift')
      .leftJoinAndSelect('shift.location', 'loc')
      .leftJoinAndSelect('fa.staff', 'fromStaff')
      .leftJoinAndSelect('sr.toUser', 'toUser')
      .orderBy('sr.createdAt', 'DESC')
      .take(take)
      .skip(offset);

    if (user.role === UserRole.STAFF) {
      qb.where('fa.staffId = :uid OR sr.toUserId = :uid', { uid: user.id });
    } else if (user.role === UserRole.MANAGER) {
      const managedIds = user.managedLocations?.map((l) => l.id) ?? [
        '__none__',
      ];
      qb.where('shift.locationId IN (:...managedIds)', { managedIds });
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, total, limit: take, offset };
  }

  async create(dto: CreateSwapRequestDto, requester: User) {
    const pendingCount = await this.swapRepo.count({
      where: {
        fromAssignment: { staffId: requester.id },
        status: SwapRequestStatus.PENDING,
      },
    });
    if (pendingCount >= MAX_PENDING_REQUESTS) {
      throw new BadRequestException(
        `You cannot have more than ${MAX_PENDING_REQUESTS} pending swap requests at once.`,
      );
    }

    const assignment = await this.assignRepo.findOne({
      where: {
        id: dto.fromAssignmentId,
        staffId: requester.id,
        status: AssignmentStatus.ASSIGNED,
      },
      relations: ['shift', 'shift.location', 'shift.requiredSkill'],
    });
    if (!assignment)
      throw new NotFoundException('Assignment not found or not yours');

    const toUser = await this.userRepo.findOne({
      where: { id: dto.toUserId },
      relations: ['skills', 'certifiedLocations'],
    });
    if (!toUser) throw new NotFoundException('Target staff member not found');

    const constraintResult = await this.constraints.check(
      assignment.shift,
      toUser,
    );
    if (!constraintResult.valid) {
      throw new BadRequestException({
        message: `${toUser.name} cannot take this shift`,
        violations: constraintResult.violations,
      });
    }

    const saved = await this.dataSource.transaction(async (em) => {
      const swap = em.create(SwapRequest, {
        fromAssignmentId: dto.fromAssignmentId,
        toUserId: dto.toUserId,
        reason: dto.reason ?? null,
      });
      const savedSwap = await em.save(SwapRequest, swap);
      assignment.status = AssignmentStatus.PENDING_SWAP;
      await em.save(ShiftAssignment, assignment);
      return savedSwap;
    });

    this.safeEmit('notification.send', {
      userId: dto.toUserId,
      type: NotificationType.SWAP_REQUEST_RECEIVED,
      title: 'Swap Request',
      message: `${requester.name} wants to swap a shift with you on ${assignment.shift.date} at ${assignment.shift.location.name}.`,
      entityType: 'swap_request',
      entityId: saved.id,
    });

    this.safeEmit('audit.log', {
      entity: 'swap_request',
      entityId: saved.id,
      action: 'created',
      locationId: assignment.shift.locationId,
      after: { fromAssignmentId: dto.fromAssignmentId, toUserId: dto.toUserId },
      performedById: requester.id,
    });

    return saved;
  }

  async accept(swapId: string, user: User) {
    const swap = await this.findOneOr404(swapId);
    if (swap.toUserId !== user.id)
      throw new ForbiddenException('This swap request is not for you');
    if (swap.status !== SwapRequestStatus.PENDING) {
      throw new BadRequestException('Swap is no longer pending');
    }

    swap.status = SwapRequestStatus.ACCEPTED;
    const saved = await this.swapRepo.save(swap);

    this.safeEmit('notification.send', {
      userId: swap.fromAssignment.staffId,
      type: NotificationType.SWAP_REQUEST_ACCEPTED,
      title: 'Swap Accepted',
      message: `${user.name} accepted your swap request. Awaiting manager approval.`,
      entityType: 'swap_request',
      entityId: swapId,
    });

    this.safeEmit('notification.sendToManagers', {
      locationId: swap.fromAssignment.shift.locationId,
      type: NotificationType.SWAP_REQUEST_RECEIVED,
      title: 'Swap Awaiting Approval',
      message: `${swap.fromAssignment.staff.name} and ${user.name} have agreed to swap a shift on ${swap.fromAssignment.shift.date}. Requires your approval.`,
      entityType: 'swap_request',
      entityId: swapId,
    });

    this.safeEmit('audit.log', {
      entity: 'swap_request',
      entityId: swapId,
      action: 'accepted',
      locationId: swap.fromAssignment.shift.locationId,
      performedById: user.id,
    });

    return saved;
  }

  async reject(swapId: string, user: User) {
    const swap = await this.findOneOr404(swapId);
    if (swap.toUserId !== user.id) throw new ForbiddenException();
    if (swap.status !== SwapRequestStatus.PENDING) {
      throw new BadRequestException('Swap is no longer pending');
    }

    const saved = await this.dataSource.transaction(async (em) => {
      swap.status = SwapRequestStatus.REJECTED;
      const savedSwap = await em.save(SwapRequest, swap);
      await em.update(ShiftAssignment, swap.fromAssignmentId, {
        status: AssignmentStatus.ASSIGNED,
      });
      return savedSwap;
    });

    this.safeEmit('notification.send', {
      userId: swap.fromAssignment.staffId,
      type: NotificationType.SWAP_REQUEST_REJECTED,
      title: 'Swap Rejected',
      message: `${user.name} rejected your swap request.`,
      entityType: 'swap_request',
      entityId: swapId,
    });

    this.safeEmit('audit.log', {
      entity: 'swap_request',
      entityId: swapId,
      action: 'rejected',
      locationId: swap.fromAssignment.shift.locationId,
      performedById: user.id,
    });

    return saved;
  }

  async approve(swapId: string, manager: User, dto: ReviewSwapDto) {
    const swap = await this.findOneOr404(swapId);
    if (swap.status !== SwapRequestStatus.ACCEPTED) {
      throw new BadRequestException(
        'Swap must be accepted by both parties first',
      );
    }

    if (manager.role === UserRole.MANAGER) {
      const locationId = swap.fromAssignment?.shift?.locationId;
      const manages = manager.managedLocations?.some(
        (l) => l.id === locationId,
      );
      if (!manages)
        throw new ForbiddenException('You do not manage this shift location');
    }

    const saved = await this.dataSource.transaction(async (em) => {
      const locked = await em.findOne(SwapRequest, {
        where: { id: swapId },
        lock: { mode: 'pessimistic_write' },
        relations: ['fromAssignment', 'fromAssignment.shift'],
      });
      if (!locked || locked.status !== SwapRequestStatus.ACCEPTED) {
        throw new BadRequestException(
          'Swap is no longer in an approvable state',
        );
      }
      await em.update(ShiftAssignment, locked.fromAssignmentId, {
        status: AssignmentStatus.CANCELLED,
      });
      const newAssignment = em.create(ShiftAssignment, {
        shiftId: locked.fromAssignment.shiftId,
        staffId: locked.toUserId,
        assignedById: manager.id,
      });
      await em.save(ShiftAssignment, newAssignment);
      locked.status = SwapRequestStatus.APPROVED;
      locked.managerId = manager.id;
      locked.managerNote = dto.managerNote ?? null;
      locked.reviewedAt = new Date();
      return em.save(SwapRequest, locked);
    });

    for (const userId of [swap.fromAssignment.staffId, swap.toUserId]) {
      this.safeEmit('notification.send', {
        userId,
        type: NotificationType.SWAP_REQUEST_APPROVED,
        title: 'Swap Approved',
        message: `Your shift swap has been approved by ${manager.name}.`,
        entityType: 'swap_request',
        entityId: swapId,
      });
    }

    this.safeEmit('schedule.updated', {
      locationId: swap.fromAssignment.shift.locationId,
    });
    this.safeEmit('audit.log', {
      entity: 'swap_request',
      entityId: swapId,
      action: 'approved',
      locationId: swap.fromAssignment.shift.locationId,
      performedById: manager.id,
      note: dto.managerNote,
    });

    return saved;
  }

  async deny(swapId: string, manager: User, dto: ReviewSwapDto) {
    const swap = await this.findOneOr404(swapId);
    if (swap.status !== SwapRequestStatus.ACCEPTED) {
      throw new BadRequestException(
        'Cannot deny a swap that has not been accepted by both parties',
      );
    }

    if (manager.role === UserRole.MANAGER) {
      const locationId = swap.fromAssignment?.shift?.locationId;
      const manages = manager.managedLocations?.some(
        (l) => l.id === locationId,
      );
      if (!manages)
        throw new ForbiddenException('You do not manage this shift location');
    }

    const saved = await this.dataSource.transaction(async (em) => {
      swap.status = SwapRequestStatus.DENIED;
      swap.managerId = manager.id;
      swap.managerNote = dto.managerNote ?? null;
      swap.reviewedAt = new Date();
      const savedSwap = await em.save(SwapRequest, swap);
      await em.update(ShiftAssignment, swap.fromAssignmentId, {
        status: AssignmentStatus.ASSIGNED,
      });
      return savedSwap;
    });

    for (const userId of [swap.fromAssignment.staffId, swap.toUserId]) {
      this.safeEmit('notification.send', {
        userId,
        type: NotificationType.SWAP_REQUEST_DENIED,
        title: 'Swap Denied',
        message: `Your shift swap has been denied by ${manager.name}. ${dto.managerNote ?? ''}`,
        entityType: 'swap_request',
        entityId: swapId,
      });
    }

    return saved;
  }

  async cancel(swapId: string, user: User) {
    const swap = await this.findOneOr404(swapId);
    if (swap.fromAssignment.staffId !== user.id) throw new ForbiddenException();
    if (
      ![SwapRequestStatus.PENDING, SwapRequestStatus.ACCEPTED].includes(
        swap.status,
      )
    ) {
      throw new BadRequestException('Cannot cancel this swap');
    }

    const saved = await this.dataSource.transaction(async (em) => {
      swap.status = SwapRequestStatus.CANCELLED;
      const savedSwap = await em.save(SwapRequest, swap);
      await em.update(ShiftAssignment, swap.fromAssignmentId, {
        status: AssignmentStatus.ASSIGNED,
      });
      return savedSwap;
    });

    this.safeEmit('notification.send', {
      userId: swap.toUserId,
      type: NotificationType.SWAP_REQUEST_REJECTED,
      title: 'Swap Cancelled',
      message: `${user.name} cancelled the swap request.`,
      entityType: 'swap_request',
      entityId: swapId,
    });

    return saved;
  }

  @Cron('*/5 * * * *')
  async expirePendingSwaps() {
    const pending = await this.swapRepo
      .createQueryBuilder('sr')
      .leftJoinAndSelect('sr.fromAssignment', 'a')
      .leftJoinAndSelect('a.shift', 'shift')
      .leftJoinAndSelect('shift.location', 'loc')
      .leftJoinAndSelect('sr.toUser', 'toUser')
      .where('sr.status = :pending', { pending: SwapRequestStatus.PENDING })
      .getMany();

    const cutoff = new Date(Date.now() + 24 * 60 * 60 * 1000);

    for (const swap of pending) {
      const shift = swap.fromAssignment?.shift;
      if (!shift?.location?.timezone) continue;
      const { startUTC } = shiftToUTCRange(
        shift.date,
        shift.startTime,
        shift.endTime,
        shift.location.timezone,
      );
      if (startUTC > cutoff) continue;

      swap.status = SwapRequestStatus.CANCELLED;
      await this.swapRepo.save(swap);
      await this.assignRepo.update(swap.fromAssignmentId, {
        status: AssignmentStatus.ASSIGNED,
      });

      for (const userId of [swap.fromAssignment.staffId, swap.toUserId]) {
        this.safeEmit('notification.send', {
          userId,
          type: NotificationType.SWAP_REQUEST_EXPIRED,
          title: 'Swap Request Expired',
          message: `A pending swap request for the shift on ${shift.date} was automatically cancelled because the shift starts in less than 24 hours.`,
          entityType: 'swap_request',
          entityId: swap.id,
        });
      }
    }
  }

  private async findOneOr404(id: string) {
    const swap = await this.swapRepo.findOne({
      where: { id },
      relations: [
        'fromAssignment',
        'fromAssignment.shift',
        'fromAssignment.shift.location',
        'fromAssignment.staff',
        'toUser',
      ],
    });
    if (!swap) throw new NotFoundException('Swap request not found');
    return swap;
  }
}
