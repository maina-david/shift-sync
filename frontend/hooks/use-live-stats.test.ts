import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLiveStats, useSseNotifications, useScheduleStream } from './use-live-stats';

vi.mock('@/contexts/auth-context', () => ({
  useAuth: vi.fn(),
}));

vi.mock('./use-sse', () => ({
  useSse: vi.fn(() => ({ data: null, status: 'closed', error: null, close: vi.fn() })),
}));

import { useAuth } from '@/contexts/auth-context';
import { useSse } from './use-sse';

const mockUseAuth = vi.mocked(useAuth);
const mockUseSse = vi.mocked(useSse);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:3001');
  mockUseSse.mockReturnValue({ data: null, status: 'closed', error: null, close: vi.fn() });
});

// ── useLiveStats ─────────────────────────────────────────────────────────────

describe('useLiveStats', () => {
  it('passes null url when there is no token', () => {
    mockUseAuth.mockReturnValue({ token: null, user: null } as any);
    renderHook(() => useLiveStats());
    expect(mockUseSse).toHaveBeenCalledWith(null);
  });

  it('passes null url when token exists but user role is staff', () => {
    mockUseAuth.mockReturnValue({ token: 'tok', user: { role: 'staff' } } as any);
    renderHook(() => useLiveStats());
    expect(mockUseSse).toHaveBeenCalledWith(null);
  });

  it('passes null url when token exists but user role is area_manager', () => {
    mockUseAuth.mockReturnValue({ token: 'tok', user: { role: 'area_manager' } } as any);
    renderHook(() => useLiveStats());
    expect(mockUseSse).toHaveBeenCalledWith(null);
  });

  it('constructs the correct url for an admin user', () => {
    mockUseAuth.mockReturnValue({ token: 'abc123', user: { role: 'admin' } } as any);
    renderHook(() => useLiveStats());
    expect(mockUseSse).toHaveBeenCalledWith(
      'http://localhost:3001/analytics/live?token=abc123',
    );
  });

  it('constructs the correct url for a manager user', () => {
    mockUseAuth.mockReturnValue({ token: 'mgr-tok', user: { role: 'manager' } } as any);
    renderHook(() => useLiveStats());
    expect(mockUseSse).toHaveBeenCalledWith(
      'http://localhost:3001/analytics/live?token=mgr-tok',
    );
  });

  it('URL-encodes the token', () => {
    mockUseAuth.mockReturnValue({ token: 'tok+special=', user: { role: 'admin' } } as any);
    renderHook(() => useLiveStats());
    const call = mockUseSse.mock.calls[0][0] as string;
    expect(call).toContain(encodeURIComponent('tok+special='));
  });

  it('returns the result from useSse', () => {
    const sseResult = { data: { activeShiftsToday: 3 } as any, status: 'open' as const, error: null, close: vi.fn() };
    mockUseAuth.mockReturnValue({ token: 'tok', user: { role: 'admin' } } as any);
    mockUseSse.mockReturnValue(sseResult);
    const { result } = renderHook(() => useLiveStats());
    expect(result.current).toBe(sseResult);
  });
});

// ── useSseNotifications ───────────────────────────────────────────────────────

describe('useSseNotifications', () => {
  it('passes null url when there is no token', () => {
    mockUseAuth.mockReturnValue({ token: null, user: null } as any);
    renderHook(() => useSseNotifications());
    expect(mockUseSse).toHaveBeenCalledWith(null);
  });

  it('constructs the correct url for any authenticated user', () => {
    mockUseAuth.mockReturnValue({ token: 'my-token', user: { role: 'staff' } } as any);
    renderHook(() => useSseNotifications());
    expect(mockUseSse).toHaveBeenCalledWith(
      'http://localhost:3001/notifications/stream?token=my-token',
    );
  });
});

// ── useScheduleStream ─────────────────────────────────────────────────────────

describe('useScheduleStream', () => {
  it('passes null url for a staff user', () => {
    mockUseAuth.mockReturnValue({ token: 'tok', user: { role: 'staff' } } as any);
    renderHook(() => useScheduleStream());
    expect(mockUseSse).toHaveBeenCalledWith(null);
  });

  it('passes null url when there is no token', () => {
    mockUseAuth.mockReturnValue({ token: null, user: null } as any);
    renderHook(() => useScheduleStream());
    expect(mockUseSse).toHaveBeenCalledWith(null);
  });

  it('constructs the correct url for a manager', () => {
    mockUseAuth.mockReturnValue({ token: 'mgr', user: { role: 'manager' } } as any);
    renderHook(() => useScheduleStream());
    expect(mockUseSse).toHaveBeenCalledWith(
      'http://localhost:3001/shifts/stream?token=mgr',
    );
  });

  it('constructs the correct url for an admin', () => {
    mockUseAuth.mockReturnValue({ token: 'adm', user: { role: 'admin' } } as any);
    renderHook(() => useScheduleStream());
    expect(mockUseSse).toHaveBeenCalledWith(
      'http://localhost:3001/shifts/stream?token=adm',
    );
  });
});
