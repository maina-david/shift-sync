import { api } from './client';
import type { SwapRequest } from '../types';

export const swapRequestsApi = {
  list: () => api.get('/swap-requests').then((r) => r.data.items as SwapRequest[]),
  create: (data: { fromAssignmentId: string; toUserId: string; reason?: string }) =>
    api.post('/swap-requests', data).then((r) => r.data),
  accept: (id: string) => api.patch(`/swap-requests/${id}/accept`).then((r) => r.data),
  reject: (id: string) => api.patch(`/swap-requests/${id}/reject`).then((r) => r.data),
  approve: (id: string, managerNote?: string) =>
    api.patch(`/swap-requests/${id}/approve`, { managerNote }).then((r) => r.data),
  deny: (id: string, managerNote?: string) =>
    api.patch(`/swap-requests/${id}/deny`, { managerNote }).then((r) => r.data),
  cancel: (id: string) => api.delete(`/swap-requests/${id}`).then((r) => r.data),
};
