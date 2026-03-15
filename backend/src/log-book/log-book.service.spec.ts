import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { LogBookService } from './log-book.service';
import { LogEntry } from './entities/log-entry.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { Location } from '../locations/entities/location.entity';

function buildQb(opts: { getMany?: any[] } = {}) {
  return {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(opts.getMany ?? []),
  };
}

const makeEntry = (overrides: any = {}): LogEntry =>
  ({
    id: 'entry-1',
    date: '2026-03-15',
    locationId: 'loc-1',
    note: 'All good',
    authorId: 'manager-1',
    ...overrides,
  } as unknown as LogEntry);

const makeManager = (managedLocationIds: string[] = ['loc-1']): User =>
  ({
    id: 'manager-1',
    name: 'Marcus Johnson',
    role: UserRole.MANAGER,
    managedLocations: managedLocationIds.map((id) => ({ id } as Location)),
  } as unknown as User);

const makeAdmin = (): User =>
  ({ id: 'admin-1', role: UserRole.ADMIN } as unknown as User);

const makeStaff = (): User =>
  ({ id: 'staff-1', role: UserRole.STAFF } as unknown as User);

describe('LogBookService', () => {
  let service: LogBookService;
  let repo: jest.Mocked<any>;
  let userRepo: jest.Mocked<any>;

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    userRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LogBookService,
        { provide: getRepositoryToken(LogEntry), useValue: repo },
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile();

    service = module.get<LogBookService>(LogBookService);
  });

  describe('list', () => {
    it('returns entries for admin without location restriction', async () => {
      const qb = buildQb({ getMany: [makeEntry()] });
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.list('2026-03-15', undefined, makeAdmin());
      expect(result).toHaveLength(1);
    });

    it('scopes manager results to managed locations', async () => {
      const qb = buildQb({ getMany: [makeEntry()] });
      repo.createQueryBuilder.mockReturnValue(qb);
      userRepo.findOne.mockResolvedValue({ managedLocations: [{ id: 'loc-1' }] });

      const result = await service.list('2026-03-15', undefined, makeManager());
      expect(qb.andWhere).toHaveBeenCalled();
    });

    it('returns empty array when manager has no managed locations', async () => {
      const qb = buildQb();
      repo.createQueryBuilder.mockReturnValue(qb);
      userRepo.findOne.mockResolvedValue({ managedLocations: [] });

      const result = await service.list('2026-03-15', undefined, makeManager([]));
      expect(result).toEqual([]);
    });

    it('scopes to specific location when manager provides it and it is in their managed list', async () => {
      const qb = buildQb({ getMany: [makeEntry()] });
      repo.createQueryBuilder.mockReturnValue(qb);
      userRepo.findOne.mockResolvedValue({ managedLocations: [{ id: 'loc-1' }] });

      await service.list('2026-03-15', 'loc-1', makeManager(['loc-1']));
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('locationId'),
        expect.objectContaining({ locationId: 'loc-1' }),
      );
    });
  });

  describe('create', () => {
    it('throws ForbiddenException when staff tries to create an entry', async () => {
      await expect(
        service.create({ date: '2026-03-15', locationId: 'loc-1', note: 'Test' } as any, makeStaff()),
      ).rejects.toThrow(ForbiddenException);
    });

    it('creates and saves entry for manager', async () => {
      const entry = makeEntry();
      repo.create.mockReturnValue(entry);
      repo.save.mockResolvedValue(entry);

      const result = await service.create(
        { date: '2026-03-15', locationId: 'loc-1', note: 'All good' } as any,
        makeManager(),
      );
      expect(result.id).toBe('entry-1');
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when entry does not exist', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.remove('missing', makeAdmin())).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when non-admin tries to delete another user\'s entry', async () => {
      repo.findOne.mockResolvedValue(makeEntry({ authorId: 'manager-2' }));
      await expect(service.remove('entry-1', makeManager())).rejects.toThrow(ForbiddenException);
    });

    it('allows admin to delete any entry', async () => {
      const entry = makeEntry({ authorId: 'manager-2' });
      repo.findOne.mockResolvedValue(entry);
      repo.remove.mockResolvedValue(undefined);
      await service.remove('entry-1', makeAdmin());
      expect(repo.remove).toHaveBeenCalledWith(entry);
    });

    it('allows author to delete their own entry', async () => {
      const entry = makeEntry({ authorId: 'manager-1' });
      repo.findOne.mockResolvedValue(entry);
      repo.remove.mockResolvedValue(undefined);
      await service.remove('entry-1', makeManager());
      expect(repo.remove).toHaveBeenCalledWith(entry);
    });
  });
});
