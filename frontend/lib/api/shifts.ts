import { api } from "./client";

export const shiftsApi = {
  list: (params?: {
    locationId?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) =>
    api
      .get("/shifts", { params: { limit: 200, ...params } })
      .then((r) => r.data.data ?? r.data),

  get: (id: string) => api.get(`/shifts/${id}`).then((r) => r.data),

  create: (data: {
    locationId: string;
    date: string;
    startTime: string;
    endTime: string;
    requiredSkillId?: string;
    headcount?: number;
    notes?: string;
  }) => api.post("/shifts", data).then((r) => r.data),

  update: (
    id: string,
    data: Partial<{
      date: string;
      startTime: string;
      endTime: string;
      requiredSkillId: string;
      headcount: number;
      notes: string;
    }>,
  ) => api.patch(`/shifts/${id}`, data).then((r) => r.data),

  publish: (id: string) =>
    api.patch(`/shifts/${id}/publish`).then((r) => r.data),
  unpublish: (id: string) =>
    api.patch(`/shifts/${id}/unpublish`).then((r) => r.data),
  publishWeek: (locationId: string, weekStart: string) =>
    api
      .post("/shifts/publish-week", { locationId, weekStart })
      .then((r) => r.data),
  copyWeek: (
    sourceWeekStart: string,
    targetWeekStart: string,
    locationId: string,
  ) =>
    api
      .post("/shifts/copy-week", {
        sourceWeekStart,
        targetWeekStart,
        locationId,
      })
      .then((r) => r.data),
  remove: (id: string) => api.delete(`/shifts/${id}`).then((r) => r.data),

  validateAssignment: (
    shiftId: string,
    staffId: string,
    overrideReason?: string,
  ) =>
    api
      .post(`/shifts/${shiftId}/validate-assignment`, {
        staffId,
        overrideReason,
      })
      .then((r) => r.data),
  assignStaff: (shiftId: string, staffId: string, overrideReason?: string) =>
    api
      .post(`/shifts/${shiftId}/assignments`, { staffId, overrideReason })
      .then((r) => r.data),
  removeAssignment: (shiftId: string, assignmentId: string) =>
    api
      .delete(`/shifts/${shiftId}/assignments/${assignmentId}`)
      .then((r) => r.data),
  confirmAssignment: (shiftId: string, assignmentId: string) =>
    api
      .patch(`/shifts/${shiftId}/assignments/${assignmentId}/confirm`)
      .then((r) => r.data),

  availableForPickup: () => api.get("/shifts/available").then((r) => r.data),
  onDutyNow: () => api.get("/shifts/on-duty-now").then((r) => r.data),

  autoSchedule: (data: {
    locationId: string;
    weekStart: string;
    shiftsPerDay?: number;
    minStaffPerShift?: number;
  }) => api.post("/shifts/auto-schedule", data).then((r) => r.data),
};
