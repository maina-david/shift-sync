import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SettingsService } from './settings.service';
import { SystemSetting } from './entities/system-setting.entity';
import { DEFAULT_SETTINGS } from './settings.defaults';

const makeSetting = (key: string, value: unknown): SystemSetting =>
  ({
    id: `setting-${key}`,
    key,
    value,
    description: null,
  }) as unknown as SystemSetting;

describe('SettingsService', () => {
  let service: SettingsService;
  let repo: jest.Mocked<any>;

  beforeEach(async () => {
    repo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((data: any) => data),
      save: jest.fn().mockImplementation((s: any) => Promise.resolve(s)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: getRepositoryToken(SystemSetting), useValue: repo },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
    // Manually prime the cache to avoid needing a full DB seed in unit tests
    await service.onModuleInit();
  });

  describe('get', () => {
    it('returns the cached value for a known key', async () => {
      await service.set('scheduling.minRestHours', { value: 12 });
      expect(service.get('scheduling.minRestHours')).toBe(12);
    });

    it('returns the fallback when key is not in cache', () => {
      expect(service.get('non.existent.key', 99)).toBe(99);
    });
  });

  describe('getScheduling', () => {
    it('returns scheduling defaults when cache is empty', () => {
      const result = service.getScheduling();
      expect(result.minRestHours).toBe(
        DEFAULT_SETTINGS.scheduling.minRestHours,
      );
      expect(result.weeklyOvertimeHours).toBe(
        DEFAULT_SETTINGS.scheduling.weeklyOvertimeHours,
      );
      expect(result.maxConsecutiveDaysHard).toBe(
        DEFAULT_SETTINGS.scheduling.maxConsecutiveDaysHard,
      );
    });
  });

  describe('getPayroll', () => {
    it('returns payroll defaults when cache is empty', () => {
      const result = service.getPayroll();
      expect(result.overtimeMultiplier).toBe(
        DEFAULT_SETTINGS.payroll.overtimeMultiplier,
      );
      expect(result.weeklyOvertimeThresholdHours).toBe(
        DEFAULT_SETTINGS.payroll.weeklyOvertimeThresholdHours,
      );
    });
  });

  describe('set', () => {
    it('updates existing setting and keeps cache in sync', async () => {
      repo.findOne.mockResolvedValue(
        makeSetting('scheduling.minRestHours', 10),
      );
      repo.save.mockImplementation((s: any) => Promise.resolve(s));

      await service.set('scheduling.minRestHours', { value: 8 });
      expect(service.get('scheduling.minRestHours')).toBe(8);
    });

    it('creates a new setting when key does not exist', async () => {
      repo.findOne.mockResolvedValue(null);
      await service.set('custom.key', { value: 42 });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'custom.key', value: 42 }),
      );
    });

    it('updates description when provided', async () => {
      const existing = makeSetting('scheduling.minRestHours', 10);
      repo.findOne.mockResolvedValue(existing);
      repo.save.mockImplementation((s: any) => Promise.resolve(s));

      await service.set('scheduling.minRestHours', {
        value: 10,
        description: 'New description',
      });
      expect(existing.description).toBe('New description');
    });

    it('toggles isEnabled without changing value', async () => {
      const existing = {
        ...makeSetting('scheduling.minRestHours', 10),
        isEnabled: true,
      };
      repo.findOne.mockResolvedValue(existing);
      repo.save.mockImplementation((s: any) => Promise.resolve(s));

      await service.set('scheduling.minRestHours', { isEnabled: false });
      expect(existing.isEnabled).toBe(false);
      // value should be unchanged
      expect(service.get('scheduling.minRestHours')).not.toBe(false);
    });
  });

  describe('findAll', () => {
    it('returns all settings ordered by key', async () => {
      repo.find.mockResolvedValue([makeSetting('a', 1), makeSetting('b', 2)]);
      const result = await service.findAll();
      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({ order: { key: 'ASC' } }),
      );
      expect(result).toHaveLength(2);
    });
  });
});
