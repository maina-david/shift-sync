import { api } from './client';
import type { ScheduleTemplate, TemplateShift } from '../types';

export const scheduleTemplatesApi = {
  list: (locationId?: string): Promise<ScheduleTemplate[]> =>
    api.get('/schedule-templates', { params: locationId ? { locationId } : undefined }).then((r) => r.data),
  get: (id: string): Promise<ScheduleTemplate> =>
    api.get(`/schedule-templates/${id}`).then((r) => r.data),
  create: (data: {
    name: string;
    locationId: string;
    shifts: TemplateShift[];
  }): Promise<ScheduleTemplate> => api.post('/schedule-templates', data).then((r) => r.data),
  remove: (id: string) => api.delete(`/schedule-templates/${id}`).then((r) => r.data),
  apply: (id: string, weekStart: string) =>
    api.post(`/schedule-templates/${id}/apply`, { weekStart }).then((r) => r.data),
};
