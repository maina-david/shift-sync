import { api } from './client';

export const dropRequestsApi = {
  list: () => api.get('/drop-requests').then((r) => r.data),
  create: (data: { assignmentId: string; reason?: string }) =>
    api.post('/drop-requests', data).then((r) => r.data),
  claim: (id: string) => api.patch(`/drop-requests/${id}/claim`).then((r) => r.data),
  approve: (id: string, managerNote?: string) =>
    api.patch(`/drop-requests/${id}/approve`, { managerNote }).then((r) => r.data),
  reject: (id: string, managerNote?: string) =>
    api.patch(`/drop-requests/${id}/reject`, { managerNote }).then((r) => r.data),
  cancel: (id: string) => api.delete(`/drop-requests/${id}`).then((r) => r.data),
};
