import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { BookmarksService } from './bookmarks.service';
import { Bookmark } from './entities/bookmark.entity';

const makeBookmark = (overrides: any = {}): Bookmark =>
  ({
    id: 'bm-1',
    userId: 'user-1',
    entityType: 'shift',
    entityId: 'shift-1',
    createdAt: new Date('2026-01-01'),
    ...overrides,
  } as unknown as Bookmark);

describe('BookmarksService', () => {
  let service: BookmarksService;
  let repo: jest.Mocked<any>;

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookmarksService,
        { provide: getRepositoryToken(Bookmark), useValue: repo },
      ],
    }).compile();

    service = module.get<BookmarksService>(BookmarksService);
  });

  describe('findAll', () => {
    it('returns all bookmarks for the given user', async () => {
      repo.find.mockResolvedValue([makeBookmark()]);
      const result = await service.findAll('user-1');
      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1' } }),
      );
      expect(result).toHaveLength(1);
    });

    it('returns empty array when user has no bookmarks', async () => {
      repo.find.mockResolvedValue([]);
      const result = await service.findAll('user-1');
      expect(result).toEqual([]);
    });
  });

  describe('create', () => {
    it('creates and saves a bookmark for the user', async () => {
      const bm = makeBookmark();
      repo.create.mockReturnValue(bm);
      repo.save.mockResolvedValue(bm);

      const result = await service.create({ entityType: 'shift', entityId: 'shift-1' } as any, 'user-1');
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1' }),
      );
      expect(result.id).toBe('bm-1');
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when bookmark does not exist or belong to user', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.remove('bm-missing', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('removes and returns snapshot of the bookmark', async () => {
      const bm = makeBookmark();
      repo.findOne.mockResolvedValue(bm);
      repo.remove.mockResolvedValue(undefined);

      const result = await service.remove('bm-1', 'user-1');
      expect(repo.remove).toHaveBeenCalledWith(bm);
      expect(result.id).toBe('bm-1');
    });
  });
});
