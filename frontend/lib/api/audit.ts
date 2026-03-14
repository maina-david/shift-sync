import { api } from './client';
import type { AuditLog } from '../types';

export const auditApi = {
  list: (params?: {
    entity?: string;
    entityId?: string;
    locationId?: string;
    startDate?: string;
    endDate?: string;
  }) => api.get('/audit', { params }).then((r) => r.data.data as AuditLog[]),
  forShift: (shiftId: string) => api.get(`/audit/shift/${shiftId}`).then((r) => r.data),
  exportUrl: (params: {
    entity?: string;
    locationId?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    const q = new URLSearchParams();
    if (params.entity) q.set('entity', params.entity);
    if (params.locationId) q.set('locationId', params.locationId);
    if (params.startDate) q.set('startDate', params.startDate);
    if (params.endDate) q.set('endDate', params.endDate);
    return `${api.defaults.baseURL}/audit/export?${q.toString()}`;
  },
};
