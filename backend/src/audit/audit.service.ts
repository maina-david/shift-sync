import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { AuditLog } from './entities/audit-log.entity';

export interface AuditPayload {
  entity: string;
  entityId: string;
  action: string;
  locationId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  performedById?: string;
  note?: string;
}

@Injectable()
export class AuditService {
  constructor(@InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>) {}

  @OnEvent('audit.log')
  async log(payload: AuditPayload) {
    const entry = this.auditRepo.create({
      entity: payload.entity,
      entityId: payload.entityId,
      action: payload.action,
      locationId: payload.locationId ?? null,
      before: payload.before ?? null,
      after: payload.after ?? null,
      performedById: payload.performedById ?? null,
      note: payload.note ?? null,
    });
    return this.auditRepo.save(entry);
  }

  async findAll(filters: {
    entity?: string;
    entityId?: string;
    locationId?: string;
    startDate?: string;
    endDate?: string;
    performedById?: string;
    page?: number;
    limit?: number;
  }) {
    if (filters.startDate && filters.endDate && filters.endDate < filters.startDate) {
      throw new BadRequestException('endDate must be on or after startDate');
    }

    const limit = Math.min(filters.limit ?? 50, 200);
    const offset = ((filters.page ?? 1) - 1) * limit;

    const qb = this.auditRepo
      .createQueryBuilder('al')
      .leftJoinAndSelect('al.performedBy', 'user')
      .orderBy('al.timestamp', 'DESC')
      .skip(offset)
      .take(limit);

    if (filters.entity) qb.andWhere('al.entity = :entity', { entity: filters.entity });
    if (filters.entityId) qb.andWhere('al.entityId = :entityId', { entityId: filters.entityId });
    if (filters.performedById) qb.andWhere('al.performedById = :pid', { pid: filters.performedById });
    if (filters.startDate) qb.andWhere('al.timestamp >= :start', { start: filters.startDate });
    if (filters.endDate) qb.andWhere('al.timestamp <= :end', { end: filters.endDate + 'T23:59:59Z' });
    if (filters.locationId) {
      qb.andWhere('al.locationId = :locationId', { locationId: filters.locationId });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page: filters.page ?? 1, limit };
  }

  findForShift(shiftId: string) {
    return this.auditRepo.find({
      where: [
        { entity: 'shift', entityId: shiftId },
        { entity: 'shift_assignment', entityId: shiftId },
      ],
      order: { timestamp: 'DESC' },
    });
  }

  async exportCsv(filters: {
    entity?: string;
    locationId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<string> {
    const { data: logs } = await this.findAll({ ...filters, page: 1, limit: 200 });
    const header = ['timestamp', 'entity', 'entityId', 'action', 'performedBy', 'note', 'before', 'after'];
    const rows = logs.map((l) => [
      l.timestamp.toISOString(),
      l.entity,
      l.entityId,
      l.action,
      l.performedBy?.name ?? l.performedById ?? '',
      l.note ?? '',
      l.before ? JSON.stringify(l.before) : '',
      l.after ? JSON.stringify(l.after) : '',
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
    return [header.join(','), ...rows].join('\n');
  }
}
