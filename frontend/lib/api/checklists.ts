import { api } from './client';
import type { Checklist } from '../types';

export const checklistsApi = {
  list: (params?: { locationId?: string; date?: string }): Promise<Checklist[]> =>
    api.get('/checklists', { params }).then((r) => r.data),
  get: (id: string): Promise<Checklist> => api.get(`/checklists/${id}`).then((r) => r.data),
  create: (data: {
    type: string;
    title: string;
    locationId: string;
    shiftId?: string;
    assignedToId?: string;
    items: { label: string; required: boolean }[];
  }) => api.post('/checklists', data).then((r) => r.data),
  completeItem: (checklistId: string, itemId: string) =>
    api.patch(`/checklists/${checklistId}/items/${itemId}/complete`).then((r) => r.data),
  remove: (id: string) => api.delete(`/checklists/${id}`).then((r) => r.data),
};
