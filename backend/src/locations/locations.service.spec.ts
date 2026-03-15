import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { Location, DEFAULT_FLOOR_ZONES } from './entities/location.entity';

const makeLocation = (overrides: any = {}): Location =>
  ({
    id: 'loc-1',
    name: 'North Beach',
    timezone: 'America/Los_Angeles',
    zones: [],
    ...overrides,
  } as unknown as Location);

describe('LocationsService', () => {
  let service: LocationsService;
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
        LocationsService,
        { provide: getRepositoryToken(Location), useValue: repo },
      ],
    }).compile();

    service = module.get<LocationsService>(LocationsService);
  });

  describe('findAll', () => {
    it('returns all locations ordered by name', async () => {
      repo.find.mockResolvedValue([makeLocation()]);
      const result = await service.findAll();
      expect(repo.find).toHaveBeenCalledWith(expect.objectContaining({ order: { name: 'ASC' } }));
      expect(result).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when location does not exist', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });

    it('returns the location when found', async () => {
      const loc = makeLocation();
      repo.findOne.mockResolvedValue(loc);
      const result = await service.findOne('loc-1');
      expect(result.id).toBe('loc-1');
    });
  });

  describe('create', () => {
    it('creates and saves a location', async () => {
      const loc = makeLocation();
      repo.create.mockReturnValue(loc);
      repo.save.mockResolvedValue(loc);
      const result = await service.create({ name: 'North Beach', timezone: 'America/Los_Angeles' } as any);
      expect(repo.save).toHaveBeenCalled();
      expect(result.name).toBe('North Beach');
    });
  });

  describe('update', () => {
    it('throws NotFoundException when location does not exist', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.update('missing', {})).rejects.toThrow(NotFoundException);
    });

    it('merges dto fields and saves', async () => {
      const loc = makeLocation();
      repo.findOne.mockResolvedValue(loc);
      repo.save.mockImplementation((l: any) => Promise.resolve(l));
      const result = await service.update('loc-1', { name: 'Updated' });
      expect(result.name).toBe('Updated');
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when location does not exist', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
    });

    it('removes the location when found', async () => {
      const loc = makeLocation();
      repo.findOne.mockResolvedValue(loc);
      repo.remove.mockResolvedValue(loc);
      await service.remove('loc-1');
      expect(repo.remove).toHaveBeenCalledWith(loc);
    });
  });

  describe('updateZones', () => {
    it('replaces zones and saves', async () => {
      const loc = makeLocation();
      repo.findOne.mockResolvedValue(loc);
      repo.save.mockImplementation((l: any) => Promise.resolve(l));

      const zones = [{ id: 'zone-1', name: 'Bar', color: '#ff0000', position: { x: 0, y: 0, w: 2, h: 2 } }];
      const result = await service.updateZones('loc-1', zones as any);
      expect(result.zones).toBe(zones);
    });
  });

  describe('resetZones', () => {
    it('resets zones to DEFAULT_FLOOR_ZONES', async () => {
      const loc = makeLocation();
      repo.findOne.mockResolvedValue(loc);
      repo.save.mockImplementation((l: any) => Promise.resolve(l));

      const result = await service.resetZones('loc-1');
      expect(result.zones).toBe(DEFAULT_FLOOR_ZONES);
    });
  });
});
