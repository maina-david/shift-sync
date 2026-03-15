import { api } from "./client";
import type { FloorZoneConfig } from "../types";

export const locationsApi = {
  list: () => api.get("/locations").then((r) => r.data),
  get: (id: string) => api.get(`/locations/${id}`).then((r) => r.data),
  create: (data: { name: string; timezone: string; address: string }) =>
    api.post("/locations", data).then((r) => r.data),
  update: (
    id: string,
    data: Partial<{ name: string; timezone: string; address: string }>,
  ) => api.patch(`/locations/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/locations/${id}`).then((r) => r.data),
  updateZones: (id: string, zones: FloorZoneConfig[]) =>
    api.put(`/locations/${id}/zones`, { zones }).then((r) => r.data),
  resetZones: (id: string) =>
    api.delete(`/locations/${id}/zones`).then((r) => r.data),
};
