import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { MenuService } from './menu.service';
import { MenuItem } from './entities/menu-item.entity';

const makeItem = (overrides: any = {}): MenuItem =>
  ({
    id: 'item-1',
    name: 'Latte',
    isAvailable: true,
    isTodaysHighlight: false,
    sortOrder: 1,
    locationId: null,
    ...overrides,
  } as unknown as MenuItem);

describe('MenuService', () => {
  let service: MenuService;
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
        MenuService,
        { provide: getRepositoryToken(MenuItem), useValue: repo },
      ],
    }).compile();

    service = module.get<MenuService>(MenuService);
  });

  describe('findAll', () => {
    it('returns available items ordered by sortOrder', async () => {
      repo.find.mockResolvedValue([makeItem()]);
      const result = await service.findAll();
      expect(repo.find).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });
  });

  describe('findHighlights', () => {
    it('returns only today\'s highlights', async () => {
      repo.find.mockResolvedValue([makeItem({ isTodaysHighlight: true })]);
      const result = await service.findHighlights();
      expect(repo.find).toHaveBeenCalled();
      expect(result[0].isTodaysHighlight).toBe(true);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when item does not exist', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });

    it('returns item when found', async () => {
      repo.findOne.mockResolvedValue(makeItem());
      const result = await service.findOne('item-1');
      expect(result.id).toBe('item-1');
    });
  });

  describe('create', () => {
    it('creates and saves a menu item', async () => {
      const item = makeItem();
      repo.create.mockReturnValue(item);
      repo.save.mockResolvedValue(item);
      const result = await service.create({ name: 'Latte' } as any);
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('throws NotFoundException when item does not exist', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.update('missing', {})).rejects.toThrow(NotFoundException);
    });

    it('merges dto and saves', async () => {
      repo.findOne.mockResolvedValue(makeItem());
      repo.save.mockImplementation((i: any) => Promise.resolve(i));
      const result = await service.update('item-1', { name: 'Cappuccino' });
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('toggleHighlight', () => {
    it('flips isTodaysHighlight from false to true', async () => {
      repo.findOne.mockResolvedValue(makeItem({ isTodaysHighlight: false }));
      repo.save.mockImplementation((i: any) => Promise.resolve(i));
      const result = await service.toggleHighlight('item-1');
      expect(result.isTodaysHighlight).toBe(true);
    });

    it('flips isTodaysHighlight from true to false', async () => {
      repo.findOne.mockResolvedValue(makeItem({ isTodaysHighlight: true }));
      repo.save.mockImplementation((i: any) => Promise.resolve(i));
      const result = await service.toggleHighlight('item-1');
      expect(result.isTodaysHighlight).toBe(false);
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when item does not exist', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
    });

    it('removes the item when found', async () => {
      const item = makeItem();
      repo.findOne.mockResolvedValue(item);
      repo.remove.mockResolvedValue(item);
      await service.remove('item-1');
      expect(repo.remove).toHaveBeenCalledWith(item);
    });
  });
});
