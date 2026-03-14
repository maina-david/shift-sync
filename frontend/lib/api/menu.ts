import { api } from './client';
import type { MenuItem } from '../types';

export const menuApi = {
  highlights: (locationId?: string): Promise<MenuItem[]> =>
    api.get('/menu/highlights', { params: locationId ? { locationId } : undefined }).then((r) => r.data),
  list: (locationId?: string): Promise<MenuItem[]> =>
    api.get('/menu', { params: locationId ? { locationId } : undefined }).then((r) => r.data),
  listAdmin: (locationId?: string): Promise<MenuItem[]> =>
    api.get('/menu/admin', { params: locationId ? { locationId } : undefined }).then((r) => r.data),
  create: (data: {
    name: string;
    description?: string;
    price: number;
    category?: string;
    tag?: string;
    tagColor?: string;
    isAvailable?: boolean;
    isTodaysHighlight?: boolean;
    sortOrder?: number;
    locationId?: string;
  }) => api.post('/menu', data).then((r) => r.data),
  update: (
    id: string,
    data: Partial<{
      name: string;
      description: string;
      price: number;
      category: string;
      tag: string;
      tagColor: string;
      isAvailable: boolean;
      isTodaysHighlight: boolean;
      sortOrder: number;
      locationId: string | null;
    }>,
  ) => api.patch(`/menu/${id}`, data).then((r) => r.data),
  toggleHighlight: (id: string) => api.patch(`/menu/${id}/toggle-highlight`).then((r) => r.data),
  remove: (id: string) => api.delete(`/menu/${id}`).then((r) => r.data),
};
