import { api } from './client';
import type { Message } from '../types';

export const messagesApi = {
  send: (data: {
    type: 'direct' | 'announcement';
    recipientId?: string;
    locationId?: string;
    body: string;
  }) => api.post('/messages', data).then((r) => r.data),
  getInbox: (): Promise<Message[]> => api.get('/messages/inbox').then((r) => r.data),
  getThread: (userId: string): Promise<Message[]> =>
    api.get(`/messages/thread/${userId}`).then((r) => r.data),
  getAnnouncements: (locationId?: string): Promise<Message[]> =>
    api
      .get('/messages/announcements', { params: locationId ? { locationId } : undefined })
      .then((r) => r.data),
  markRead: (id: string) => api.patch(`/messages/${id}/read`).then((r) => r.data),
  markAllRead: () => api.patch('/messages/read-all').then((r) => r.data),
};
