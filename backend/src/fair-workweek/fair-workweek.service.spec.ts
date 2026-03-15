import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FairWorkweekService } from './fair-workweek.service';
import { ScheduleChangeLog } from './entities/schedule-change-log.entity';

function buildQb(opts: { getMany?: any[] } = {}) {
  return {
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(opts.getMany ?? []),
  };
}

const makeLog = (overrides: any = {}): ScheduleChangeLog =>
  ({
    id: 'log-1',
    triggersPredictabilityPay: true,
    predictabilityPayAmount: 25.0,
    ...overrides,
  }) as unknown as ScheduleChangeLog;

describe('FairWorkweekService', () => {
  let service: FairWorkweekService;
  let repo: jest.Mocked<any>;

  beforeEach(async () => {
    repo = { createQueryBuilder: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FairWorkweekService,
        { provide: getRepositoryToken(ScheduleChangeLog), useValue: repo },
      ],
    }).compile();

    service = module.get<FairWorkweekService>(FairWorkweekService);
  });

  describe('getViolations', () => {
    it('returns all violations without filters', async () => {
      const qb = buildQb({ getMany: [makeLog()] });
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getViolations();
      expect(result).toHaveLength(1);
      expect(qb.andWhere).not.toHaveBeenCalled();
    });

    it('applies locationId filter when provided', async () => {
      const qb = buildQb({ getMany: [] });
      repo.createQueryBuilder.mockReturnValue(qb);

      await service.getViolations('loc-1');
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('locationId'),
        expect.objectContaining({ locationId: 'loc-1' }),
      );
    });

    it('applies date range filters when provided', async () => {
      const qb = buildQb({ getMany: [] });
      repo.createQueryBuilder.mockReturnValue(qb);

      await service.getViolations(undefined, '2026-01-01', '2026-01-31');
      expect(qb.andWhere).toHaveBeenCalledTimes(2);
    });
  });

  describe('getSummary', () => {
    it('returns zeros when no violations exist', async () => {
      const qb = buildQb({ getMany: [] });
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getSummary();
      expect(result.totalViolations).toBe(0);
      expect(result.totalPredictabilityPayOwed).toBe(0);
      expect(result.locationId).toBeNull();
    });

    it('sums predictabilityPayAmount across violations', async () => {
      const qb = buildQb({
        getMany: [
          makeLog({ predictabilityPayAmount: 25.0 }),
          makeLog({ id: 'log-2', predictabilityPayAmount: 50.5 }),
        ],
      });
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getSummary();
      expect(result.totalViolations).toBe(2);
      expect(result.totalPredictabilityPayOwed).toBe(75.5);
    });

    it('scopes summary to locationId when provided', async () => {
      const qb = buildQb({ getMany: [makeLog()] });
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getSummary('loc-1');
      expect(result.locationId).toBe('loc-1');
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('locationId'),
        expect.objectContaining({ locationId: 'loc-1' }),
      );
    });

    it('handles null predictabilityPayAmount entries gracefully', async () => {
      const qb = buildQb({
        getMany: [
          makeLog({ predictabilityPayAmount: null }),
          makeLog({ id: 'log-2', predictabilityPayAmount: 30.0 }),
        ],
      });
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getSummary();
      expect(result.totalPredictabilityPayOwed).toBe(30.0);
    });
  });
});
