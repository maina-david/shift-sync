import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Reservation } from './entities/reservation.entity';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';

@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);

  constructor(
    @InjectRepository(Reservation) private repo: Repository<Reservation>,
    private events: EventEmitter2,
  ) {}

  private safeEmit(event: string, payload: unknown): void {
    try {
      this.events.emit(event, payload);
    } catch (err) {
      this.logger.error(`Event emission failed for "${event}": ${(err as Error).message}`, (err as Error).stack);
    }
  }

  async create(dto: CreateReservationDto) {
    const saved = await this.repo.save(this.repo.create(dto));

    const message = `New reservation: ${dto.customerName} — party of ${dto.partySize} on ${dto.date} at ${dto.time}.`;
    if (dto.locationId) {
      this.safeEmit('notification.sendToManagers', {
        locationId: dto.locationId,
        type: 'NEW_RESERVATION',
        title: 'New Reservation',
        message,
        entityType: 'reservation',
        entityId: saved.id,
      });
    }
    this.safeEmit('notification.sendToAdmins', {
      type: 'NEW_RESERVATION',
      title: 'New Reservation',
      message,
      entityType: 'reservation',
      entityId: saved.id,
    });

    return saved;
  }

  findAll(filters: { date?: string; locationId?: string; status?: string }) {
    const qb = this.repo.createQueryBuilder('r')
      .leftJoinAndSelect('r.location', 'location')
      .orderBy('r.date', 'ASC')
      .addOrderBy('r.time', 'ASC')
      .take(200);

    if (filters.date)       qb.andWhere('r.date = :date',             { date: filters.date });
    if (filters.locationId) qb.andWhere('r.locationId = :locationId', { locationId: filters.locationId });
    if (filters.status)     qb.andWhere('r.status = :status',         { status: filters.status });

    return qb.getMany();
  }

  async findOne(id: string) {
    const r = await this.repo.findOne({ where: { id }, relations: ['location'] });
    if (!r) throw new NotFoundException('Reservation not found');
    return r;
  }

  async update(id: string, dto: UpdateReservationDto) {
    const r = await this.findOne(id);
    return this.repo.save({ ...r, ...dto });
  }

  async remove(id: string) {
    const r = await this.findOne(id);
    return this.repo.remove(r);
  }
}
