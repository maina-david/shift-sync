import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ChecklistsService } from './checklists.service';
import { Checklist } from './entities/checklist.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { Location } from '../locations/entities/location.entity';

function buildQb(opts: { getMany?: any[] } = {}) {
  return {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(opts.getMany ?? []),
  };
}

const makeChecklist = (overrides: any = {}): Checklist =>
  ({
    id: 'cl-1',
    type: 'opening',
    title: 'Opening Checklist',
    locationId: 'loc-1',
    shiftId: null,
    assignedToId: null,
    isCompleted: false,
    completedAt: null,
    items: [
      { id: 'item-1', label: 'Turn on lights', required: true, completedAt: null, completedById: null },
      { id: 'item-2', label: 'Check inventory', required: false, completedAt: null, completedById: null },
    ],
    ...overrides,
  } as unknown as Checklist);

const makeManager = (managedLocationIds: string[] = ['loc-1']): User =>
  ({
    id: 'manager-1',
    role: UserRole.MANAGER,
    managedLocations: managedLocationIds.map((id) => ({ id } as Location)),
  } as unknown as User);

const makeAdmin = (): User =>
  ({ id: 'admin-1', role: UserRole.ADMIN, managedLocations: [] } as unknown as User);

describe('ChecklistsService', () => {
  let service: ChecklistsService;
  let repo: jest.Mocked<any>;

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChecklistsService,
        { provide: getRepositoryToken(Checklist), useValue: repo },
      ],
    }).compile();

    service = module.get<ChecklistsService>(ChecklistsService);
  });

  describe('create', () => {
    it('creates checklist with mapped items', async () => {
      const cl = makeChecklist();
      repo.create.mockReturnValue(cl);
      repo.save.mockResolvedValue(cl);

      const result = await service.create(
        {
          type: 'opening',
          title: 'Opening Checklist',
          locationId: 'loc-1',
          items: [{ label: 'Turn on lights', required: true }],
        } as any,
        'manager-1',
      );
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('returns all checklists for admin without restriction', async () => {
      const qb = buildQb({ getMany: [makeChecklist()] });
      repo.createQueryBuilder.mockReturnValue(qb);
      const result = await service.findAll(undefined, undefined, makeAdmin());
      expect(result).toHaveLength(1);
    });

    it('scopes results to manager\'s managed locations', async () => {
      const qb = buildQb({ getMany: [makeChecklist()] });
      repo.createQueryBuilder.mockReturnValue(qb);
      const manager = makeManager(['loc-1']);
      await service.findAll(undefined, undefined, manager);
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('managedIds'),
        expect.any(Object),
      );
    });

    it('throws ForbiddenException when manager requests unmanaged location', async () => {
      const qb = buildQb();
      repo.createQueryBuilder.mockReturnValue(qb);
      const manager = makeManager(['loc-other']);
      await expect(service.findAll('loc-1', undefined, manager)).rejects.toThrow(ForbiddenException);
    });

    it('returns empty array when manager has no managed locations', async () => {
      const qb = buildQb();
      repo.createQueryBuilder.mockReturnValue(qb);
      const manager = makeManager([]);
      const result = await service.findAll(undefined, undefined, manager);
      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when checklist does not exist', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });

    it('returns checklist when found', async () => {
      repo.findOne.mockResolvedValue(makeChecklist());
      const result = await service.findOne('cl-1');
      expect(result.id).toBe('cl-1');
    });
  });

  describe('completeItem', () => {
    it('throws NotFoundException when item does not exist in checklist', async () => {
      repo.findOne.mockResolvedValue(makeChecklist());
      await expect(service.completeItem('cl-1', 'bad-item', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('marks item as completed with userId and timestamp', async () => {
      const cl = makeChecklist();
      repo.findOne.mockResolvedValue(cl);
      repo.save.mockImplementation((c: any) => Promise.resolve(c));

      const result = await service.completeItem('cl-1', 'item-1', 'user-1');
      const completedItem = result.items.find((i: any) => i.id === 'item-1');
      expect(completedItem!.completedAt).toBeDefined();
      expect(completedItem!.completedById).toBe('user-1');
    });

    it('marks checklist as complete when all required items are done', async () => {
      const cl = makeChecklist({
        items: [
          { id: 'item-1', label: 'Required', required: true, completedAt: null, completedById: null },
        ],
      });
      repo.findOne.mockResolvedValue(cl);
      repo.save.mockImplementation((c: any) => Promise.resolve(c));

      const result = await service.completeItem('cl-1', 'item-1', 'user-1');
      expect(result.isCompleted).toBe(true);
      expect(result.completedAt).toBeDefined();
    });

    it('does not mark checklist complete when optional items remain', async () => {
      const cl = makeChecklist({
        items: [
          { id: 'item-1', label: 'Required', required: true, completedAt: '2026-01-01T09:00:00.000Z', completedById: 'user-1' },
          { id: 'item-2', label: 'Optional', required: false, completedAt: null, completedById: null },
        ],
      });
      repo.findOne.mockResolvedValue(cl);
      repo.save.mockImplementation((c: any) => Promise.resolve(c));

      const result = await service.completeItem('cl-1', 'item-2', 'user-1');
      expect(result.isCompleted).toBe(true);
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when checklist does not exist', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
    });

    it('removes the checklist when found', async () => {
      const cl = makeChecklist();
      repo.findOne.mockResolvedValue(cl);
      repo.remove.mockResolvedValue(undefined);
      await service.remove('cl-1');
      expect(repo.remove).toHaveBeenCalledWith(cl);
    });
  });
});
