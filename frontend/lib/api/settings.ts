import { api } from './client';
import type { SystemSetting } from '../types';

export const settingsApi = {
  list: (): Promise<SystemSetting[]> => api.get('/settings').then((r) => r.data),
  update: (key: string, value: unknown, description?: string) =>
    api.patch(`/settings/${encodeURIComponent(key)}`, { value, description }).then((r) => r.data),
  reset: () => api.post('/settings/reset').then((r) => r.data),
};
