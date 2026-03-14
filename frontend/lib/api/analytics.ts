import { api } from './client';
import type { LaborCostReport, KpiRollup, AbsenteeismReport, TurnoverReport } from '../types';

export const analyticsApi = {
  hoursDistribution: (startDate: string, endDate: string, locationId?: string) =>
    api.get('/analytics/hours', { params: { startDate, endDate, locationId } }).then((r) => r.data),
  fairness: (startDate: string, endDate: string, locationId?: string) =>
    api.get('/analytics/fairness', { params: { startDate, endDate, locationId } }).then((r) => r.data),
  overtime: (weekStart: string, locationId?: string) =>
    api.get('/analytics/overtime', { params: { weekStart, locationId } }).then((r) => r.data),
  laborCost: (startDate: string, endDate: string, locationId?: string): Promise<LaborCostReport> =>
    api.get('/analytics/labor-cost', { params: { startDate, endDate, ...(locationId ? { locationId } : {}) } }).then((r) => r.data),
  kpiRollup: (startDate: string, endDate: string): Promise<KpiRollup[]> =>
    api.get('/analytics/kpi-rollup', { params: { startDate, endDate } }).then((r) => r.data),
  absenteeism: (startDate: string, endDate: string, locationId?: string): Promise<AbsenteeismReport> =>
    api.get('/analytics/absenteeism', { params: { startDate, endDate, ...(locationId ? { locationId } : {}) } }).then((r) => r.data),
  turnover: (): Promise<TurnoverReport> =>
    api.get('/analytics/turnover').then((r) => r.data),
};
