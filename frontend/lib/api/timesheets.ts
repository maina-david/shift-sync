import { api } from "./client";
import type { Timesheet } from "../types";

export const timesheetsApi = {
  clockIn: (data: {
    assignmentId?: string;
    shiftId?: string;
    coordinates?: string;
  }) => api.post("/timesheets/clock-in", data).then((r) => r.data),
  clockOut: (data: { breakMinutes?: number }) =>
    api.post("/timesheets/clock-out", data).then((r) => r.data),
  getOpen: (): Promise<Timesheet | null> =>
    api
      .get("/timesheets/open")
      .then((r) => r.data)
      .catch(() => null),
  getMine: (): Promise<Timesheet[]> =>
    api.get("/timesheets/me").then((r) => r.data),
  list: (params?: {
    staffId?: string;
    locationId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<Timesheet[]> =>
    api.get("/timesheets", { params }).then((r) => r.data),
  review: (
    id: string,
    data: { status: "approved" | "rejected"; managerNote?: string },
  ) => api.patch(`/timesheets/${id}/review`, data).then((r) => r.data),
  exportUrl: (params: {
    locationId?: string;
    startDate: string;
    endDate: string;
  }) => {
    const q = new URLSearchParams({ ...params } as Record<string, string>);
    return `${api.defaults.baseURL}/timesheets/export?${q.toString()}`;
  },
};
