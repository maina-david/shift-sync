import { api } from "./client";
import type { ScheduleChangeLog } from "../types";

export const fairWorkweekApi = {
  getViolations: (params?: {
    locationId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<ScheduleChangeLog[]> =>
    api.get("/fair-workweek/violations", { params }).then((r) => r.data),
  getSummary: (locationId?: string) =>
    api
      .get("/fair-workweek/summary", {
        params: locationId ? { locationId } : undefined,
      })
      .then((r) => r.data),
};
