'use client';

import { useAuth } from '@/contexts/auth-context';
import { useSse } from './use-sse';

export interface LiveStats {
  /** Number of shift assignments in ASSIGNED status for today */
  activeShiftsToday: number;
  /** Time-off requests waiting for manager decision */
  pendingTimeOff: number;
  /** Swap requests waiting for target staff to accept/reject */
  swapsAwaitingResponse: number;
  /** Swap requests accepted by staff, waiting for manager approval */
  swapsAwaitingManager: number;
  /** Drop requests open and waiting to be claimed */
  openDrops: number;
  /** Reservations for today still in PENDING status */
  pendingReservations: number;
  /** ISO timestamp of when this snapshot was generated */
  timestamp: string;
}

/**
 * Connects to the `/analytics/live` SSE endpoint and returns a live snapshot
 * of actionable dashboard metrics, refreshed every 30 seconds by the server.
 *
 * Returns `null` while connecting or when the user is not authenticated /
 * does not have the required role (admin/manager).
 *
 * @example
 * const { data: stats, status } = useLiveStats();
 * if (stats) console.log(stats.activeShiftsToday);
 */
export function useLiveStats() {
  const { token, user } = useAuth();

  const isAllowed = user?.role === 'admin' || user?.role === 'manager';
  const url =
    token && isAllowed
      ? `${process.env.NEXT_PUBLIC_API_URL}/analytics/live?token=${encodeURIComponent(token)}`
      : null;

  return useSse<LiveStats>(url);
}

/**
 * Connects to the `/notifications/stream` SSE endpoint and streams real-time
 * notification payloads for the authenticated user.
 *
 * Intended as a lightweight alternative to the WebSocket gateway — useful in
 * environments where WebSocket connections are restricted.
 */
export interface SseNotificationPayload {
  userId: string;
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
}

export function useSseNotifications() {
  const { token } = useAuth();

  const url = token
    ? `${process.env.NEXT_PUBLIC_API_URL}/notifications/stream?token=${encodeURIComponent(token)}`
    : null;

  return useSse<SseNotificationPayload>(url);
}

/**
 * Connects to the `/shifts/stream` SSE endpoint and fires whenever a schedule
 * change occurs on one of the user's managed locations.
 *
 * Useful for triggering a schedule refetch without polling.
 *
 * @example
 * const { data: change } = useScheduleStream();
 * useEffect(() => { if (change) refetch(); }, [change]);
 */
export interface ScheduleChangePayload {
  locationId?: string;
  shiftId?: string;
  weekStart?: string;
}

export function useScheduleStream() {
  const { token, user } = useAuth();

  const isAllowed = user?.role === 'admin' || user?.role === 'manager';
  const url =
    token && isAllowed
      ? `${process.env.NEXT_PUBLIC_API_URL}/shifts/stream?token=${encodeURIComponent(token)}`
      : null;

  return useSse<ScheduleChangePayload>(url);
}
