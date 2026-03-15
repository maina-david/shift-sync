import { api } from "./client";

export const logBookApi = {
  list: (date: string, locationId?: string) =>
    api.get("/log-book", { params: { date, locationId } }).then((r) => r.data),
  create: (data: { date: string; locationId: string; note: string }) =>
    api.post("/log-book", data).then((r) => r.data),
  remove: (id: string) => api.delete(`/log-book/${id}`).then((r) => r.data),
};
