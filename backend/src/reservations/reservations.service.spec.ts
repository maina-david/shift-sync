import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ReservationsService } from './reservations.service';
import { Reservation, ReservationStatus } from './entities/reservation.entity';

function buildQb(opts: { getMany?: any[] } = {}) {
  return {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(opts.getMany ?? []),
  };
}

const makeReservation = (overrides: any = {}): Reservation =>
  ({
    id: 'res-1',
    customerName: 'Jane Doe',
    partySize: 4,
    date: '2026-04-01',
    time: '19:00',
    locationId: 'loc-1',
    status: ReservationStatus.PENDING,
    ...overrides,
  } as unknown as Reservation);

describe('ReservationsService', () => {
  let service: ReservationsService;
  let repo: jest.Mocked<any>;
  let events: jest.Mocked<any>;

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    events = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationsService,
        { provide: getRepositoryToken(Reservation), useValue: repo },
        { provide: EventEmitter2, useValue: events },
      ],
    }).compile();

    service = module.get<ReservationsService>(ReservationsService);
  });

  describe('create', () => {
    it('saves and notifies managers and admins', async () => {
      const res = makeReservation();
      repo.create.mockReturnValue(res);
      repo.save.mockResolvedValue(res);

      const result = await service.create({
        customerName: 'Jane Doe',
        partySize: 4,
        date: '2026-04-01',
        time: '19:00',
        locationId: 'loc-1',
      } as any);

      expect(result.id).toBe('res-1');
      expect(events.emit).toHaveBeenCalledWith(
        'notification.sendToManagers',
        expect.objectContaining({ locationId: 'loc-1' }),
      );
      expect(events.emit).toHaveBeenCalledWith(
        'notification.sendToAdmins',
        expect.any(Object),
      );
    });

    it('skips manager notification when no locationId', async () => {
      const res = makeReservation({ locationId: undefined });
      repo.create.mockReturnValue(res);
      repo.save.mockResolvedValue(res);

      await service.create({ customerName: 'Jane', partySize: 2, date: '2026-04-01', time: '18:00' } as any);
      expect(events.emit).not.toHaveBeenCalledWith('notification.sendToManagers', expect.any(Object));
    });
  });

  describe('findAll', () => {
    it('returns reservations without filters', async () => {
      const qb = buildQb({ getMany: [makeReservation()] });
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll({});
      expect(result).toHaveLength(1);
    });

    it('applies date, locationId, and status filters', async () => {
      const qb = buildQb({ getMany: [] });
      repo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ date: '2026-04-01', locationId: 'loc-1', status: 'PENDING' });
      expect(qb.andWhere).toHaveBeenCalledTimes(3);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when reservation not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });

    it('returns reservation when found', async () => {
      repo.findOne.mockResolvedValue(makeReservation());
      const result = await service.findOne('res-1');
      expect(result.id).toBe('res-1');
    });
  });

  describe('update', () => {
    it('throws NotFoundException when reservation not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.update('missing', {})).rejects.toThrow(NotFoundException);
    });

    it('merges dto and saves', async () => {
      repo.findOne.mockResolvedValue(makeReservation());
      repo.save.mockImplementation((r: any) => Promise.resolve(r));
      const result = await service.update('res-1', { status: ReservationStatus.CONFIRMED } as any);
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when reservation not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
    });

    it('removes when found', async () => {
      const res = makeReservation();
      repo.findOne.mockResolvedValue(res);
      repo.remove.mockResolvedValue(res);
      await service.remove('res-1');
      expect(repo.remove).toHaveBeenCalledWith(res);
    });
  });
});
