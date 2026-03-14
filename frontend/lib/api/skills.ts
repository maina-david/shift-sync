import { api } from './client';

export const skillsApi = {
  list: () => api.get('/skills').then((r) => r.data),
  create: (data: { name: string; description?: string }) =>
    api.post('/skills', data).then((r) => r.data),
  remove: (id: string) => api.delete(`/skills/${id}`).then((r) => r.data),
};
