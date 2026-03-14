import axios, { AxiosError } from 'axios';

const API_BASE = (() => {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url && process.env.NODE_ENV === 'production') {
    throw new Error('NEXT_PUBLIC_API_URL environment variable is required in production');
  }
  return url || 'http://localhost:3001';
})();

// In-memory access token — never touches localStorage
let _accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  _accessToken = token;
}

export function getAccessToken(): string | null {
  return _accessToken;
}

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // send httpOnly refresh cookie on every request
});

api.interceptors.request.use((config) => {
  if (_accessToken) config.headers.Authorization = `Bearer ${_accessToken}`;
  return config;
});

// Track whether a refresh is already in-flight to avoid concurrent refresh storms
let _refreshPromise: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = axios
    .post<{ token: string }>(`${API_BASE}/auth/refresh`, {}, { withCredentials: true })
    .then((r) => {
      _accessToken = r.data.token;
      return r.data.token;
    })
    .catch(() => {
      _accessToken = null;
      return null;
    })
    .finally(() => {
      _refreshPromise = null;
    });
  return _refreshPromise;
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as typeof error.config & { _retry?: boolean };
    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      // Don't retry on the refresh or login endpoints themselves
      !original.url?.includes('/auth/refresh') &&
      !original.url?.includes('/auth/login')
    ) {
      original._retry = true;
      const newToken = await tryRefresh();
      if (newToken) {
        original.headers = original.headers ?? {};
        original.headers['Authorization'] = `Bearer ${newToken}`;
        return api(original);
      }
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }).then((r) => r.data),
  refresh: () =>
    axios
      .post<{ token: string; user: import('./types').User }>(
        `${API_BASE}/auth/refresh`,
        {},
        { withCredentials: true },
      )
      .then((r) => r.data),
  logout: () => api.post('/auth/logout').then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
};

export const usersApi = {
  list: (locationId?: string) =>
    api.get('/users', { params: { locationId, limit: 200 } }).then((r) => r.data.data ?? r.data),
  get: (id: string) => api.get(`/users/${id}`).then((r) => r.data),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch(`/users/${id}`, data).then((r) => r.data),
  changePassword: (id: string, currentPassword: string, newPassword: string) =>
    api.patch(`/users/${id}/change-password`, { currentPassword, newPassword }).then((r) => r.data),
  resetPassword: (id: string, newPassword: string) =>
    api.patch(`/users/${id}/reset-password`, { newPassword }).then((r) => r.data),
  create: (data: { name: string; email: string; password: string; role?: string }) =>
    api.post('/auth/register', data).then((r) => r.data),
  getAvailability: (id: string) => api.get(`/users/${id}/availability`).then((r) => r.data),
  setAvailability: (id: string, slots: { dayOfWeek: number; startTime: string; endTime: string }[]) =>
    api.put(`/users/${id}/availability`, { slots }).then((r) => r.data),
  addException: (id: string, data: { date: string; startTime?: string; endTime?: string; isUnavailable?: boolean }) =>
    api.post(`/users/${id}/availability-exceptions`, data).then((r) => r.data),
  removeException: (id: string, exId: string) =>
    api.delete(`/users/${id}/availability-exceptions/${exId}`).then((r) => r.data),
};

export const locationsApi = {
  list: () => api.get('/locations').then((r) => r.data),
  get: (id: string) => api.get(`/locations/${id}`).then((r) => r.data),
  create: (data: { name: string; timezone: string; address: string }) =>
    api.post('/locations', data).then((r) => r.data),
  update: (id: string, data: Partial<{ name: string; timezone: string; address: string }>) =>
    api.patch(`/locations/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/locations/${id}`).then((r) => r.data),
  updateZones: (id: string, zones: import('./types').FloorZoneConfig[]) =>
    api.put(`/locations/${id}/zones`, { zones }).then((r) => r.data),
  resetZones: (id: string) =>
    api.delete(`/locations/${id}/zones`).then((r) => r.data),
};

export const skillsApi = {
  list: () => api.get('/skills').then((r) => r.data),
  create: (data: { name: string; description?: string }) =>
    api.post('/skills', data).then((r) => r.data),
  remove: (id: string) => api.delete(`/skills/${id}`).then((r) => r.data),
};

export const shiftsApi = {
  list: (params?: {
    locationId?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) => api.get('/shifts', { params: { limit: 200, ...params } }).then((r) => r.data.data ?? r.data),

  get: (id: string) => api.get(`/shifts/${id}`).then((r) => r.data),

  create: (data: {
    locationId: string;
    date: string;
    startTime: string;
    endTime: string;
    requiredSkillId?: string;
    headcount?: number;
    notes?: string;
  }) => api.post('/shifts', data).then((r) => r.data),

  update: (id: string, data: Partial<{ date: string; startTime: string; endTime: string; requiredSkillId: string; headcount: number; notes: string }>) =>
    api.patch(`/shifts/${id}`, data).then((r) => r.data),

  publish: (id: string) => api.patch(`/shifts/${id}/publish`).then((r) => r.data),
  unpublish: (id: string) => api.patch(`/shifts/${id}/unpublish`).then((r) => r.data),
  publishWeek: (locationId: string, weekStart: string) =>
    api.post('/shifts/publish-week', { locationId, weekStart }).then((r) => r.data),
  copyWeek: (sourceWeekStart: string, targetWeekStart: string, locationId: string) =>
    api.post('/shifts/copy-week', { sourceWeekStart, targetWeekStart, locationId }).then((r) => r.data),
  remove: (id: string) => api.delete(`/shifts/${id}`).then((r) => r.data),

  validateAssignment: (shiftId: string, staffId: string, overrideReason?: string) =>
    api.post(`/shifts/${shiftId}/validate-assignment`, { staffId, overrideReason }).then((r) => r.data),
  assignStaff: (shiftId: string, staffId: string, overrideReason?: string) =>
    api.post(`/shifts/${shiftId}/assignments`, { staffId, overrideReason }).then((r) => r.data),
  removeAssignment: (shiftId: string, assignmentId: string) =>
    api.delete(`/shifts/${shiftId}/assignments/${assignmentId}`).then((r) => r.data),
  confirmAssignment: (shiftId: string, assignmentId: string) =>
    api.patch(`/shifts/${shiftId}/assignments/${assignmentId}/confirm`).then((r) => r.data),

  availableForPickup: () => api.get('/shifts/available').then((r) => r.data),
  onDutyNow: () => api.get('/shifts/on-duty-now').then((r) => r.data),
};

export const swapRequestsApi = {
  list: () => api.get('/swap-requests').then((r) => r.data.items as import('./types').SwapRequest[]),
  create: (data: { fromAssignmentId: string; toUserId: string; reason?: string }) =>
    api.post('/swap-requests', data).then((r) => r.data),
  accept: (id: string) => api.patch(`/swap-requests/${id}/accept`).then((r) => r.data),
  reject: (id: string) => api.patch(`/swap-requests/${id}/reject`).then((r) => r.data),
  approve: (id: string, managerNote?: string) =>
    api.patch(`/swap-requests/${id}/approve`, { managerNote }).then((r) => r.data),
  deny: (id: string, managerNote?: string) =>
    api.patch(`/swap-requests/${id}/deny`, { managerNote }).then((r) => r.data),
  cancel: (id: string) => api.delete(`/swap-requests/${id}`).then((r) => r.data),
};

export const dropRequestsApi = {
  list: () => api.get('/drop-requests').then((r) => r.data),
  create: (data: { assignmentId: string; reason?: string }) =>
    api.post('/drop-requests', data).then((r) => r.data),
  claim: (id: string) => api.patch(`/drop-requests/${id}/claim`).then((r) => r.data),
  approve: (id: string, managerNote?: string) =>
    api.patch(`/drop-requests/${id}/approve`, { managerNote }).then((r) => r.data),
  reject: (id: string, managerNote?: string) =>
    api.patch(`/drop-requests/${id}/reject`, { managerNote }).then((r) => r.data),
  cancel: (id: string) => api.delete(`/drop-requests/${id}`).then((r) => r.data),
};

export const notificationsApi = {
  list: () => api.get('/notifications').then((r) => r.data.items as import('./types').Notification[]),
  unreadCount: () => api.get('/notifications/unread-count').then((r) => r.data),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () => api.patch('/notifications/read-all').then((r) => r.data),
};

export const analyticsApi = {
  hoursDistribution: (startDate: string, endDate: string, locationId?: string) =>
    api.get('/analytics/hours', { params: { startDate, endDate, locationId } }).then((r) => r.data),
  fairness: (startDate: string, endDate: string, locationId?: string) =>
    api.get('/analytics/fairness', { params: { startDate, endDate, locationId } }).then((r) => r.data),
  overtime: (weekStart: string, locationId?: string) =>
    api.get('/analytics/overtime', { params: { weekStart, locationId } }).then((r) => r.data),
};

export const logBookApi = {
  list: (date: string, locationId?: string) =>
    api.get('/log-book', { params: { date, locationId } }).then((r) => r.data),
  create: (data: { date: string; locationId: string; note: string }) =>
    api.post('/log-book', data).then((r) => r.data),
  remove: (id: string) => api.delete(`/log-book/${id}`).then((r) => r.data),
};

export const timeOffApi = {
  list: () => api.get('/time-off-requests').then((r) => r.data.items as import('./types').TimeOffRequest[]),
  create: (data: { startDate: string; endDate: string; reason?: string }) =>
    api.post('/time-off-requests', data).then((r) => r.data),
  approve: (id: string, managerNote?: string) =>
    api.patch(`/time-off-requests/${id}/approve`, { managerNote }).then((r) => r.data),
  deny: (id: string, managerNote?: string) =>
    api.patch(`/time-off-requests/${id}/deny`, { managerNote }).then((r) => r.data),
  cancel: (id: string) => api.delete(`/time-off-requests/${id}`).then((r) => r.data),
};

export const auditApi = {
  list: (params?: { entity?: string; entityId?: string; locationId?: string; startDate?: string; endDate?: string }) =>
    api.get('/audit', { params }).then((r) => r.data.data as import('./types').AuditLog[]),
  forShift: (shiftId: string) => api.get(`/audit/shift/${shiftId}`).then((r) => r.data),
  exportUrl: (params: { entity?: string; locationId?: string; startDate?: string; endDate?: string }) => {
    const q = new URLSearchParams();
    if (params.entity) q.set('entity', params.entity);
    if (params.locationId) q.set('locationId', params.locationId);
    if (params.startDate) q.set('startDate', params.startDate);
    if (params.endDate) q.set('endDate', params.endDate);
    return `${api.defaults.baseURL}/audit/export?${q.toString()}`;
  },
};

export const menuApi = {
  highlights: (locationId?: string): Promise<import('./types').MenuItem[]> =>
    api.get('/menu/highlights', { params: locationId ? { locationId } : undefined }).then((r) => r.data),
  list: (locationId?: string): Promise<import('./types').MenuItem[]> =>
    api.get('/menu', { params: locationId ? { locationId } : undefined }).then((r) => r.data),
  listAdmin: (locationId?: string): Promise<import('./types').MenuItem[]> =>
    api.get('/menu/admin', { params: locationId ? { locationId } : undefined }).then((r) => r.data),
  create: (data: {
    name: string; description?: string; price: number; category?: string;
    tag?: string; tagColor?: string; isAvailable?: boolean;
    isTodaysHighlight?: boolean; sortOrder?: number; locationId?: string;
  }) => api.post('/menu', data).then((r) => r.data),
  update: (id: string, data: Partial<{
    name: string; description: string; price: number; category: string;
    tag: string; tagColor: string; isAvailable: boolean;
    isTodaysHighlight: boolean; sortOrder: number; locationId: string | null;
  }>) => api.patch(`/menu/${id}`, data).then((r) => r.data),
  toggleHighlight: (id: string) =>
    api.patch(`/menu/${id}/toggle-highlight`).then((r) => r.data),
  remove: (id: string) => api.delete(`/menu/${id}`).then((r) => r.data),
};

export const bookmarksApi = {
  list: (): Promise<import('./types').Bookmark[]> =>
    api.get('/bookmarks').then((r) => r.data),
  create: (data: { label: string; href: string }): Promise<import('./types').Bookmark> =>
    api.post('/bookmarks', data).then((r) => r.data),
  remove: (id: string) => api.delete(`/bookmarks/${id}`).then((r) => r.data),
};

export const reservationsApi = {
  create: (data: {
    customerName: string; email: string; phone?: string;
    date: string; time: string; partySize: number;
    locationId?: string; notes?: string;
  }): Promise<import('./types').Reservation> =>
    api.post('/reservations', data).then((r) => r.data),
  list: (params?: { date?: string; locationId?: string; status?: string }): Promise<import('./types').Reservation[]> =>
    api.get('/reservations', { params }).then((r) => r.data),
  update: (id: string, data: { status?: string; notes?: string }) =>
    api.patch(`/reservations/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/reservations/${id}`).then((r) => r.data),
};

export const scheduleTemplatesApi = {
  list: (locationId?: string): Promise<import('./types').ScheduleTemplate[]> =>
    api.get('/schedule-templates', { params: locationId ? { locationId } : undefined }).then((r) => r.data),
  get: (id: string): Promise<import('./types').ScheduleTemplate> =>
    api.get(`/schedule-templates/${id}`).then((r) => r.data),
  create: (data: { name: string; locationId: string; shifts: import('./types').TemplateShift[] }): Promise<import('./types').ScheduleTemplate> =>
    api.post('/schedule-templates', data).then((r) => r.data),
  remove: (id: string) => api.delete(`/schedule-templates/${id}`).then((r) => r.data),
  apply: (id: string, weekStart: string) =>
    api.post(`/schedule-templates/${id}/apply`, { weekStart }).then((r) => r.data),
};

export const timesheetsApi = {
  clockIn: (data: { assignmentId?: string; shiftId?: string; coordinates?: string }) =>
    api.post('/timesheets/clock-in', data).then((r) => r.data),
  clockOut: (data: { breakMinutes?: number }) =>
    api.post('/timesheets/clock-out', data).then((r) => r.data),
  getOpen: (): Promise<import('./types').Timesheet | null> =>
    api.get('/timesheets/open').then((r) => r.data).catch(() => null),
  getMine: (): Promise<import('./types').Timesheet[]> =>
    api.get('/timesheets/me').then((r) => r.data),
  list: (params?: { staffId?: string; locationId?: string; status?: string; startDate?: string; endDate?: string }): Promise<import('./types').Timesheet[]> =>
    api.get('/timesheets', { params }).then((r) => r.data),
  review: (id: string, data: { status: 'approved' | 'rejected'; managerNote?: string }) =>
    api.patch(`/timesheets/${id}/review`, data).then((r) => r.data),
  exportUrl: (params: { locationId?: string; startDate: string; endDate: string }) => {
    const q = new URLSearchParams({ ...params } as Record<string, string>);
    return `${api.defaults.baseURL}/timesheets/export?${q.toString()}`;
  },
};

export const certificationsApi = {
  getMine: (): Promise<import('./types').Certification[]> =>
    api.get('/certifications/mine').then((r) => r.data),
  getForUser: (userId: string): Promise<import('./types').Certification[]> =>
    api.get(`/certifications/user/${userId}`).then((r) => r.data),
  getExpiring: (days?: number): Promise<(import('./types').Certification & { user: import('./types').User })[]> =>
    api.get('/certifications/expiring', { params: days ? { days } : undefined }).then((r) => r.data),
  create: (userId: string, data: { name: string; issuedDate: string; expiryDate: string; documentUrl?: string; issuer?: string }) =>
    api.post(`/certifications/user/${userId}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/certifications/${id}`).then((r) => r.data),
};

export const messagesApi = {
  send: (data: { type: 'direct' | 'announcement'; recipientId?: string; locationId?: string; body: string }) =>
    api.post('/messages', data).then((r) => r.data),
  getInbox: (): Promise<import('./types').Message[]> =>
    api.get('/messages/inbox').then((r) => r.data),
  getThread: (userId: string): Promise<import('./types').Message[]> =>
    api.get(`/messages/thread/${userId}`).then((r) => r.data),
  getAnnouncements: (locationId?: string): Promise<import('./types').Message[]> =>
    api.get('/messages/announcements', { params: locationId ? { locationId } : undefined }).then((r) => r.data),
  markRead: (id: string) => api.patch(`/messages/${id}/read`).then((r) => r.data),
  markAllRead: () => api.patch('/messages/read-all').then((r) => r.data),
};

export const checklistsApi = {
  list: (params?: { locationId?: string; date?: string }): Promise<import('./types').Checklist[]> =>
    api.get('/checklists', { params }).then((r) => r.data),
  get: (id: string): Promise<import('./types').Checklist> =>
    api.get(`/checklists/${id}`).then((r) => r.data),
  create: (data: { type: string; title: string; locationId: string; shiftId?: string; assignedToId?: string; items: { label: string; required: boolean }[] }) =>
    api.post('/checklists', data).then((r) => r.data),
  completeItem: (checklistId: string, itemId: string) =>
    api.patch(`/checklists/${checklistId}/items/${itemId}/complete`).then((r) => r.data),
  remove: (id: string) => api.delete(`/checklists/${id}`).then((r) => r.data),
};

export const shiftFeedbackApi = {
  submit: (data: { assignmentId: string; rating: number; comment?: string; adequatelyStaffed?: boolean; wouldRepeat?: boolean }) =>
    api.post('/shift-feedback', data).then((r) => r.data),
  getMine: (): Promise<import('./types').ShiftFeedback[]> =>
    api.get('/shift-feedback/mine').then((r) => r.data),
  getForShift: (shiftId: string): Promise<import('./types').ShiftFeedback[]> =>
    api.get(`/shift-feedback/shift/${shiftId}`).then((r) => r.data),
  getSummary: (params?: { locationId?: string; startDate?: string; endDate?: string }): Promise<import('./types').FeedbackSummary> =>
    api.get('/shift-feedback/summary', { params }).then((r) => r.data),
};

export const settingsApi = {
  list: (): Promise<import('./types').SystemSetting[]> =>
    api.get('/settings').then((r) => r.data),
  update: (key: string, value: unknown, description?: string) =>
    api.patch(`/settings/${encodeURIComponent(key)}`, { value, description }).then((r) => r.data),
  reset: () => api.post('/settings/reset').then((r) => r.data),
};

export const fairWorkweekApi = {
  getViolations: (params?: { locationId?: string; startDate?: string; endDate?: string }): Promise<import('./types').ScheduleChangeLog[]> =>
    api.get('/fair-workweek/violations', { params }).then((r) => r.data),
  getSummary: (locationId?: string) =>
    api.get('/fair-workweek/summary', { params: locationId ? { locationId } : undefined }).then((r) => r.data),
};

// ─── Analytics extensions ─────────────────────────────────────────────────────
// (add these methods to the existing analyticsApi object — but since we can't
//  easily patch it, export a new analyticsExtApi)
export const analyticsExtApi = {
  laborCost: (startDate: string, endDate: string, locationId?: string): Promise<import('./types').LaborCostReport> =>
    api.get('/analytics/labor-cost', { params: { startDate, endDate, ...(locationId ? { locationId } : {}) } }).then((r) => r.data),
  kpiRollup: (startDate: string, endDate: string): Promise<import('./types').KpiRollup[]> =>
    api.get('/analytics/kpi-rollup', { params: { startDate, endDate } }).then((r) => r.data),
  absenteeism: (startDate: string, endDate: string, locationId?: string): Promise<import('./types').AbsenteeismReport> =>
    api.get('/analytics/absenteeism', { params: { startDate, endDate, ...(locationId ? { locationId } : {}) } }).then((r) => r.data),
  turnover: (): Promise<import('./types').TurnoverReport> =>
    api.get('/analytics/turnover').then((r) => r.data),
};

export const autoScheduleApi = {
  generate: (data: { locationId: string; weekStart: string; shiftsPerDay?: number; minStaffPerShift?: number }) =>
    api.post('/shifts/auto-schedule', data).then((r) => r.data),
};

export function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data;
    if (typeof data?.message === 'string') return data.message;
    if (Array.isArray(data?.message)) return data.message.join(', ');
    if (data?.violations) {
      return (data.violations as { message: string }[]).map((v) => v.message).join('; ');
    }
  }
  if (err instanceof Error) return err.message;
  return 'An unexpected error occurred';
}
