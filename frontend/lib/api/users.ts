import { api } from "./client";

export const usersApi = {
  /** Lightweight directory (id, name, role) — available to all roles. */
  directory: (): Promise<{ id: string; name: string; role: string }[]> =>
    api.get("/users/directory").then((r) => r.data),
  list: (locationId?: string) =>
    api
      .get("/users", { params: { locationId, limit: 200 } })
      .then((r) => r.data.data ?? r.data),
  get: (id: string) => api.get(`/users/${id}`).then((r) => r.data),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch(`/users/${id}`, data).then((r) => r.data),
  changePassword: (id: string, currentPassword: string, newPassword: string) =>
    api
      .patch(`/users/${id}/change-password`, { currentPassword, newPassword })
      .then((r) => r.data),
  resetPassword: (id: string, newPassword: string) =>
    api
      .patch(`/users/${id}/reset-password`, { newPassword })
      .then((r) => r.data),
  create: (data: {
    name: string;
    email: string;
    password: string;
    role?: string;
  }) => api.post("/auth/register", data).then((r) => r.data),
  getAvailability: (id: string) =>
    api.get(`/users/${id}/availability`).then((r) => r.data),
  setAvailability: (
    id: string,
    slots: { dayOfWeek: number; startTime: string; endTime: string }[],
  ) => api.put(`/users/${id}/availability`, { slots }).then((r) => r.data),
  addException: (
    id: string,
    data: {
      date: string;
      startTime?: string;
      endTime?: string;
      isUnavailable?: boolean;
    },
  ) =>
    api.post(`/users/${id}/availability-exceptions`, data).then((r) => r.data),
  removeException: (id: string, exId: string) =>
    api
      .delete(`/users/${id}/availability-exceptions/${exId}`)
      .then((r) => r.data),
};
