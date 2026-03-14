import { api } from './client';
import type { ShiftFeedback, FeedbackSummary } from '../types';

export const shiftFeedbackApi = {
  submit: (data: {
    assignmentId: string;
    rating: number;
    comment?: string;
    adequatelyStaffed?: boolean;
    wouldRepeat?: boolean;
  }) => api.post('/shift-feedback', data).then((r) => r.data),
  getMine: (): Promise<ShiftFeedback[]> => api.get('/shift-feedback/mine').then((r) => r.data),
  getForShift: (shiftId: string): Promise<ShiftFeedback[]> =>
    api.get(`/shift-feedback/shift/${shiftId}`).then((r) => r.data),
  getSummary: (params?: {
    locationId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<FeedbackSummary> =>
    api.get('/shift-feedback/summary', { params }).then((r) => r.data),
};
