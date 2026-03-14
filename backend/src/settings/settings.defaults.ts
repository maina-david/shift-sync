export interface SchedulingSettings {
  minRestHours: number;                // minimum hours between shifts (error if violated)
  dailyWarnHours: number;              // daily hours threshold for a warning
  dailyBlockHours: number;             // daily hours hard limit (error)
  weeklyWarnHours: number;             // weekly hours soft warning
  weeklyOvertimeHours: number;         // weekly hours that trigger overtime warning
  maxConsecutiveDays: number;          // consecutive days that trigger a warning
  maxConsecutiveDaysHard: number;      // consecutive days that require override
  advanceNoticeHours: number;          // fair workweek advance notice (hours before shift)
  predictabilityPayMultiplier: number; // pay multiplier when schedule changed inside notice
}

export interface PayrollSettings {
  overtimeMultiplier: number;              // e.g. 1.5
  weeklyOvertimeThresholdHours: number;    // hours/week before OT multiplier kicks in
}

export interface DEFAULT_SETTINGS_TYPE {
  scheduling: SchedulingSettings;
  payroll: PayrollSettings;
}

export const DEFAULT_SETTINGS: DEFAULT_SETTINGS_TYPE = {
  scheduling: {
    minRestHours: 10,
    dailyWarnHours: 8,
    dailyBlockHours: 12,
    weeklyWarnHours: 35,
    weeklyOvertimeHours: 40,
    maxConsecutiveDays: 6,
    maxConsecutiveDaysHard: 7,
    advanceNoticeHours: 336,              // 14 days
    predictabilityPayMultiplier: 1.0,
  },
  payroll: {
    overtimeMultiplier: 1.5,
    weeklyOvertimeThresholdHours: 40,
  },
};
