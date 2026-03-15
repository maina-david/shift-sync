import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  TimeOffRequest,
  TimeOffStatus,
} from './entities/time-off-request.entity';
import { CreateTimeOffRequestDto } from './dto/create-time-off-request.dto';
import { User, UserRole } from '../users/entities/user.entity';

@Injectable()
export class TimeOffRequestsService {
  private readonly logger = new Logger(TimeOffRequestsService.name);

  constructor(
    @InjectRepository(TimeOffRequest)
    private repo: Repository<TimeOffRequest>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
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

  async list(requestingUser: User, limit = 50, offset = 0) {
    const take = Math.min(limit, 100);

    if (requestingUser.role === UserRole.STAFF) {
      const [items, total] = await this.repo.findAndCount({
        where: { staffId: requestingUser.id },
        order: { createdAt: 'DESC' },
        take,
        skip: offset,
      });
      return { items, total, limit: take, offset };
    }

    if (requestingUser.role === UserRole.MANAGER) {
      const managedIds =
        requestingUser.managedLocations?.map((l) => l.id) ?? [];
      if (managedIds.length === 0)
        return { items: [], total: 0, limit: take, offset };

      const staffAtLocations = await this.userRepo
        .createQueryBuilder('u')
        .innerJoin('u.certifiedLocations', 'loc')
        .where('loc.id IN (:...managedIds)', { managedIds })
        .select('u.id')
        .getMany();

      const staffIds = staffAtLocations.map((u) => u.id);
      if (staffIds.length === 0)
        return { items: [], total: 0, limit: take, offset };

      const [items, total] = await this.repo.findAndCount({
        where: { staffId: In(staffIds) },
        order: { createdAt: 'DESC' },
        take,
        skip: offset,
      });
      return { items, total, limit: take, offset };
    }

    const [items, total] = await this.repo.findAndCount({
      order: { createdAt: 'DESC' },
      take,
      skip: offset,
    });
    return { items, total, limit: take, offset };
  }

  async create(
    dto: CreateTimeOffRequestDto,
    staff: User,
  ): Promise<TimeOffRequest> {
    if (dto.endDate < dto.startDate) {
      throw new BadRequestException('End date must be on or after start date');
    }

    const today = new Date().toISOString().slice(0, 10);
    if (dto.startDate < today) {
      throw new BadRequestException(
        'Time-off requests must start on today or a future date',
      );
    }

    const startMs = new Date(dto.startDate).getTime();
    const endMs = new Date(dto.endDate).getTime();
    const MAX_DAYS = 365;
    if ((endMs - startMs) / 86_400_000 > MAX_DAYS) {
      throw new BadRequestException(
        `Time-off request cannot exceed ${MAX_DAYS} days`,
      );
    }

    const saved = await this.dataSource.transaction(async (em) => {
      // Lock existing rows for this staff member to prevent concurrent overlapping submissions
      const conflict = await em
        .createQueryBuilder(TimeOffRequest, 'r')
        .where('r.staffId = :staffId', { staffId: staff.id })
        .andWhere('r.status IN (:...statuses)', {
          statuses: [TimeOffStatus.PENDING, TimeOffStatus.APPROVED],
        })
        .andWhere('r.startDate <= :endDate', { endDate: dto.endDate })
        .andWhere('r.endDate >= :startDate', { startDate: dto.startDate })
        .setLock('pessimistic_write')
        .getOne();

      if (conflict) {
        throw new BadRequestException(
          'You already have a pending or approved time-off request that overlaps these dates',
        );
      }

      const request = em.create(TimeOffRequest, {
        staffId: staff.id,
        startDate: dto.startDate,
        endDate: dto.endDate,
        reason: dto.reason ?? null,
      });
      return em.save(TimeOffRequest, request);
    });

    this.safeEmit('time-off.requested', {
      requestId: saved.id,
      staffId: staff.id,
    });
    return saved;
  }

  async approve(
    id: string,
    manager: User,
    managerNote?: string,
  ): Promise<TimeOffRequest> {
    const request = await this.findOneOrFail(id);
    await this.assertManagerCan(manager, request);
    if (request.status !== TimeOffStatus.PENDING) {
      throw new BadRequestException('Only pending requests can be approved');
    }
    request.status = TimeOffStatus.APPROVED;
    request.reviewedById = manager.id;
    request.managerNote = managerNote ?? null;
    request.reviewedAt = new Date();
    const saved = await this.repo.save(request);
    this.safeEmit('time-off.approved', {
      requestId: saved.id,
      staffId: saved.staffId,
    });
    this.safeEmit('audit.log', {
      entity: 'time_off_request',
      entityId: id,
      action: 'approved',
      performedById: manager.id,
      after: { status: TimeOffStatus.APPROVED, managerNote },
    });
    return saved;
  }

  async deny(
    id: string,
    manager: User,
    managerNote?: string,
  ): Promise<TimeOffRequest> {
    const request = await this.findOneOrFail(id);
    await this.assertManagerCan(manager, request);
    if (request.status !== TimeOffStatus.PENDING) {
      throw new BadRequestException('Only pending requests can be denied');
    }
    request.status = TimeOffStatus.DENIED;
    request.reviewedById = manager.id;
    request.managerNote = managerNote ?? null;
    request.reviewedAt = new Date();
    const saved = await this.repo.save(request);
    this.safeEmit('time-off.denied', {
      requestId: saved.id,
      staffId: saved.staffId,
    });
    this.safeEmit('audit.log', {
      entity: 'time_off_request',
      entityId: id,
      action: 'denied',
      performedById: manager.id,
      after: { status: TimeOffStatus.DENIED, managerNote },
    });
    return saved;
  }

  async cancel(id: string, requestingUser: User): Promise<TimeOffRequest> {
    const request = await this.findOneOrFail(id);
    if (requestingUser.id !== request.staffId) {
      throw new ForbiddenException('You can only cancel your own requests');
    }
    if (request.status !== TimeOffStatus.PENDING) {
      throw new BadRequestException('Only pending requests can be cancelled');
    }
    request.status = TimeOffStatus.CANCELLED;
    return this.repo.save(request);
  }

  private async findOneOrFail(id: string): Promise<TimeOffRequest> {
    const r = await this.repo.findOne({ where: { id } });
    if (!r) throw new NotFoundException('Time-off request not found');
    return r;
  }

  private async assertManagerCan(
    manager: User,
    request: TimeOffRequest,
  ): Promise<void> {
    if (manager.role !== UserRole.ADMIN && manager.role !== UserRole.MANAGER) {
      throw new ForbiddenException();
    }
    if (manager.role === UserRole.MANAGER) {
      const [mgr, staff] = await Promise.all([
        this.userRepo.findOne({
          where: { id: manager.id },
          relations: ['managedLocations'],
        }),
        this.userRepo.findOne({
          where: { id: request.staffId },
          relations: ['certifiedLocations'],
        }),
      ]);
      const managedIds = new Set(
        (mgr?.managedLocations ?? []).map((l) => l.id),
      );
      const staffLocationIds = (staff?.certifiedLocations ?? []).map(
        (l) => l.id,
      );
      const hasOverlap = staffLocationIds.some((id) => managedIds.has(id));
      if (!hasOverlap)
        throw new ForbiddenException(
          "You do not manage any of this staff member's locations",
        );
    }
  }
}
