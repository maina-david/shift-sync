import { api } from './client';
import type { Reservation } from '../types';

export const reservationsApi = {
  create: (data: {
    customerName: string;
    email: string;
    phone?: string;
    date: string;
    time: string;
    partySize: number;
    locationId?: string;
    notes?: string;
  }): Promise<Reservation> => api.post('/reservations', data).then((r) => r.data),
  list: (params?: {
    date?: string;
    locationId?: string;
    status?: string;
  }): Promise<Reservation[]> => api.get('/reservations', { params }).then((r) => r.data),
  update: (id: string, data: { status?: string; notes?: string }) =>
    api.patch(`/reservations/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/reservations/${id}`).then((r) => r.data),
};
