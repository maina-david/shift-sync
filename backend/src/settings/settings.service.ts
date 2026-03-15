import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSetting } from './entities/system-setting.entity';
import {
  DEFAULT_SETTINGS,
  SchedulingSettings,
  PayrollSettings,
} from './settings.defaults';

@Injectable()
export class SettingsService implements OnModuleInit {
  private cache: Record<string, unknown> = {};

  constructor(
    @InjectRepository(SystemSetting)
    private repo: Repository<SystemSetting>,
  ) {}

  /** Seed defaults on first boot, then load all into memory cache. */
  async onModuleInit() {
    await this.seedDefaults();
    await this.loadCache();
  }

  private async seedDefaults() {
    const flat = flattenObject(
      DEFAULT_SETTINGS as unknown as Record<string, unknown>,
    );
    for (const [key, value] of Object.entries(flat)) {
      const existing = await this.repo.findOne({ where: { key } });
      if (!existing) {
        await this.repo.save(
          this.repo.create({ key, value, description: null, isEnabled: true }),
        );
      }
    }
  }

  private async loadCache() {
    const all = await this.repo.find();
    this.cache = {};
    for (const s of all) {
      this.cache[s.key] = s.value;
    }
  }

  get<T = unknown>(key: string, fallback?: T): T {
    return (this.cache[key] !== undefined ? this.cache[key] : fallback) as T;
  }

  getScheduling(): SchedulingSettings {
    const d = DEFAULT_SETTINGS.scheduling;
    return {
      minRestHours: this.get('scheduling.minRestHours', d.minRestHours),
      dailyWarnHours: this.get('scheduling.dailyWarnHours', d.dailyWarnHours),
      dailyBlockHours: this.get(
        'scheduling.dailyBlockHours',
        d.dailyBlockHours,
      ),
      weeklyWarnHours: this.get(
        'scheduling.weeklyWarnHours',
        d.weeklyWarnHours,
      ),
      weeklyOvertimeHours: this.get(
        'scheduling.weeklyOvertimeHours',
        d.weeklyOvertimeHours,
      ),
      maxConsecutiveDays: this.get(
        'scheduling.maxConsecutiveDays',
        d.maxConsecutiveDays,
      ),
      maxConsecutiveDaysHard: this.get(
        'scheduling.maxConsecutiveDaysHard',
        d.maxConsecutiveDaysHard,
      ),
      advanceNoticeHours: this.get(
        'scheduling.advanceNoticeHours',
        d.advanceNoticeHours,
      ),
      predictabilityPayMultiplier: this.get(
        'scheduling.predictabilityPayMultiplier',
        d.predictabilityPayMultiplier,
      ),
    };
  }

  getPayroll(): PayrollSettings {
    const d = DEFAULT_SETTINGS.payroll;
    return {
      overtimeMultiplier: this.get(
        'payroll.overtimeMultiplier',
        d.overtimeMultiplier,
      ),
      weeklyOvertimeThresholdHours: this.get(
        'payroll.weeklyOvertimeThresholdHours',
        d.weeklyOvertimeThresholdHours,
      ),
    };
  }

  async findAll(): Promise<SystemSetting[]> {
    return this.repo.find({ order: { key: 'ASC' } });
  }

  async set(
    key: string,
    patch: {
      value?: unknown;
      description?: string | null;
      isEnabled?: boolean;
    },
  ): Promise<SystemSetting> {
    let setting = await this.repo.findOne({ where: { key } });
    if (setting) {
      if (patch.value !== undefined) setting.value = patch.value;
      if (patch.description !== undefined)
        setting.description = patch.description;
      if (patch.isEnabled !== undefined) setting.isEnabled = patch.isEnabled;
    } else {
      setting = this.repo.create({
        key,
        value: patch.value,
        description: patch.description ?? null,
        isEnabled: patch.isEnabled ?? true,
      });
    }
    const saved = await this.repo.save(setting);
    if (patch.value !== undefined) this.cache[key] = patch.value;
    return saved;
  }

  async resetToDefaults(): Promise<void> {
    const flat = flattenObject(
      DEFAULT_SETTINGS as unknown as Record<string, unknown>,
    );
    for (const [key, value] of Object.entries(flat)) {
      await this.set(key, { value, isEnabled: true });
    }
  }
}

function flattenObject(
  obj: Record<string, unknown>,
  prefix = '',
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(
        result,
        flattenObject(v as Record<string, unknown>, fullKey),
      );
    } else {
      result[fullKey] = v;
    }
  }
  return result;
}
