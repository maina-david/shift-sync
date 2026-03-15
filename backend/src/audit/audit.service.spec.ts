import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditLog } from './entities/audit-log.entity';

function buildQb(
  opts: { getManyAndCount?: [any[], number]; getMany?: any[] } = {},
) {
  return {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getManyAndCount: jest
      .fn()
      .mockResolvedValue(opts.getManyAndCount ?? [[], 0]),
    getMany: jest.fn().mockResolvedValue(opts.getMany ?? []),
  };
}

const makeLog = (overrides: any = {}): AuditLog =>
  ({
    id: 'log-1',
    entity: 'shift',
    entityId: 'shift-1',
    action: 'created',
    locationId: 'loc-1',
    performedById: 'manager-1',
    performedBy: { name: 'Marcus Johnson' },
    before: null,
    after: null,
    note: null,
    timestamp: new Date('2026-03-15T10:00:00Z'),
    ...overrides,
  }) as unknown as AuditLog;

describe('AuditService', () => {
  let service: AuditService;
  let auditRepo: jest.Mocked<any>;

  beforeEach(async () => {
    auditRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: getRepositoryToken(AuditLog), useValue: auditRepo },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  describe('log', () => {
    it('creates and saves an audit log entry', async () => {
      const entry = makeLog();
      auditRepo.create.mockReturnValue(entry);
      auditRepo.save.mockResolvedValue(entry);

      const result = await service.log({
        entity: 'shift',
        entityId: 'shift-1',
        action: 'created',
        locationId: 'loc-1',
        performedById: 'manager-1',
      });
      expect(auditRepo.create).toHaveBeenCalled();
      expect(auditRepo.save).toHaveBeenCalled();
      expect(result.entity).toBe('shift');
    });

    it('stores null for optional fields when not provided', async () => {
      const entry = makeLog({
        before: null,
        after: null,
        note: null,
        locationId: null,
      });
      auditRepo.create.mockReturnValue(entry);
      auditRepo.save.mockResolvedValue(entry);

      await service.log({
        entity: 'shift',
        entityId: 'shift-1',
        action: 'created',
      });
      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          locationId: null,
          before: null,
          after: null,
          note: null,
        }),
      );
    });
  });

  describe('findAll', () => {
    it('throws BadRequestException when endDate is before startDate', async () => {
      await expect(
        service.findAll({ startDate: '2026-03-15', endDate: '2026-03-01' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns paginated audit logs', async () => {
      const qb = buildQb({ getManyAndCount: [[makeLog()], 1] });
      auditRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll({ page: 1, limit: 50 });
      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });

    it('caps limit at 200', async () => {
      const qb = buildQb({ getManyAndCount: [[], 0] });
      auditRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ limit: 9999 });
      expect(qb.take).toHaveBeenCalledWith(200);
    });

    it('applies entity filter when provided', async () => {
      const qb = buildQb({ getManyAndCount: [[], 0] });
      auditRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ entity: 'shift' });
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('entity'),
        expect.objectContaining({ entity: 'shift' }),
      );
    });

    it('applies managedLocationIds sentinel when array is empty', async () => {
      const qb = buildQb({ getManyAndCount: [[], 0] });
      auditRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ managedLocationIds: [] });
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('managedIds'),
        expect.objectContaining({ managedIds: ['__none__'] }),
      );
    });

    it('applies managedLocationIds filter when provided', async () => {
      const qb = buildQb({ getManyAndCount: [[], 0] });
      auditRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ managedLocationIds: ['loc-1', 'loc-2'] });
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('managedIds'),
        expect.objectContaining({ managedIds: ['loc-1', 'loc-2'] }),
      );
    });
  });

  describe('findForShift', () => {
    it('returns logs for both shift and shift_assignment entities', async () => {
      const logs = [makeLog(), makeLog({ entity: 'shift_assignment' })];
      auditRepo.find.mockResolvedValue(logs);

      const result = await service.findForShift('shift-1');
      expect(auditRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.arrayContaining([
            expect.objectContaining({ entity: 'shift', entityId: 'shift-1' }),
            expect.objectContaining({
              entity: 'shift_assignment',
              entityId: 'shift-1',
            }),
          ]),
        }),
      );
      expect(result).toHaveLength(2);
    });
  });

  describe('exportCsv', () => {
    it('returns CSV header row even when no logs exist', async () => {
      const qb = buildQb({ getMany: [] });
      auditRepo.createQueryBuilder.mockReturnValue(qb);

      const csv = await service.exportCsv({});
      const firstLine = csv.split('\n')[0];
      expect(firstLine).toContain('timestamp');
      expect(firstLine).toContain('entity');
      expect(firstLine).toContain('action');
    });

    it('generates CSV rows with quoted fields for each log entry', async () => {
      const qb = buildQb({
        getMany: [makeLog({ after: { status: 'APPROVED' }, note: 'test' })],
      });
      auditRepo.createQueryBuilder.mockReturnValue(qb);

      const csv = await service.exportCsv({});
      const lines = csv.split('\n');
      expect(lines).toHaveLength(2);
      expect(lines[1]).toContain('"shift"');
      expect(lines[1]).toContain('"created"');
    });

    it('escapes double quotes in CSV values', async () => {
      const qb = buildQb({ getMany: [makeLog({ note: 'he said "hello"' })] });
      auditRepo.createQueryBuilder.mockReturnValue(qb);

      const csv = await service.exportCsv({});
      expect(csv).toContain('""hello""');
    });
  });
});
