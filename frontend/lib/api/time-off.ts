import { api } from "./client";
import type { TimeOffRequest } from "../types";

export const timeOffApi = {
  list: () =>
    api.get("/time-off-requests").then((r) => r.data.items as TimeOffRequest[]),
  create: (data: { startDate: string; endDate: string; reason?: string }) =>
    api.post("/time-off-requests", data).then((r) => r.data),
  approve: (id: string, managerNote?: string) =>
    api
      .patch(`/time-off-requests/${id}/approve`, { managerNote })
      .then((r) => r.data),
  deny: (id: string, managerNote?: string) =>
    api
      .patch(`/time-off-requests/${id}/deny`, { managerNote })
      .then((r) => r.data),
  cancel: (id: string) =>
    api.delete(`/time-off-requests/${id}`).then((r) => r.data),
};
