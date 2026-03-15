import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { NotificationsProvider, useNotifications } from './notifications-context';
import { notificationsApi } from '@/lib/api';
import { useAuth } from './auth-context';

const mockSocket = { on: vi.fn(), off: vi.fn() };

vi.mock('@/lib/socket', () => ({ getSocket: () => mockSocket }));

vi.mock('./auth-context', () => ({ useAuth: vi.fn() }));

vi.mock('@/lib/api', () => ({
  notificationsApi: {
    list: vi.fn(),
    unreadCount: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
  },
  setAccessToken: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));

const mockUseAuth = vi.mocked(useAuth);
const mockNotificationsApi = vi.mocked(notificationsApi);

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <NotificationsProvider>{children}</NotificationsProvider>
);

const makeNotif = (overrides: Record<string, unknown> = {}) => ({
  id: 'n1',
  title: 'Test Notification',
  message: 'Something happened',
  isRead: false,
  type: 'info',
  createdAt: new Date().toISOString(),
  ...overrides,
});

describe('useNotifications', () => {
  it('throws when called outside NotificationsProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useNotifications())).toThrow(
      'useNotifications must be used within NotificationsProvider',
    );
    spy.mockRestore();
  });
});

describe('NotificationsProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: 'me' } } as any);
    mockNotificationsApi.list.mockResolvedValue([makeNotif()]);
    mockNotificationsApi.unreadCount.mockResolvedValue({ count: 1 } as any);
  });

  // ── Loading & initial state ──────────────────────────────────────────────

  it('starts in loading state', () => {
    mockNotificationsApi.list.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useNotifications(), { wrapper });
    expect(result.current.isLoading).toBe(true);
  });

  it('loads notifications and unreadCount on mount', async () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.unreadCount).toBe(1);
  });

  it('does not fetch when user is null', async () => {
    mockUseAuth.mockReturnValue({ user: null } as any);
    renderHook(() => useNotifications(), { wrapper });
    await new Promise((r) => setTimeout(r, 50));
    expect(mockNotificationsApi.list).not.toHaveBeenCalled();
  });

  // ── markRead ─────────────────────────────────────────────────────────────

  it('optimistically marks a notification as read', async () => {
    mockNotificationsApi.markRead.mockResolvedValue(undefined as any);
    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));

    await act(async () => { await result.current.markRead('n1'); });

    expect(result.current.notifications[0].isRead).toBe(true);
    expect(result.current.unreadCount).toBe(0);
  });

  it('calls notificationsApi.markRead with the correct id', async () => {
    mockNotificationsApi.markRead.mockResolvedValue(undefined as any);
    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));

    await act(async () => { await result.current.markRead('n1'); });
    expect(mockNotificationsApi.markRead).toHaveBeenCalledWith('n1');
  });

  it('reverts optimistic markRead on API failure', async () => {
    mockNotificationsApi.markRead.mockRejectedValue(new Error('server error'));
    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));

    await act(async () => { await result.current.markRead('n1'); });

    expect(result.current.notifications[0].isRead).toBe(false);
    expect(result.current.unreadCount).toBe(1);
  });

  it('does not go below 0 for unreadCount on markRead', async () => {
    mockNotificationsApi.list.mockResolvedValue([makeNotif({ isRead: true })]);
    mockNotificationsApi.unreadCount.mockResolvedValue({ count: 0 } as any);
    mockNotificationsApi.markRead.mockResolvedValue(undefined as any);

    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.markRead('n1'); });
    expect(result.current.unreadCount).toBe(0);
  });

  // ── markAllRead ──────────────────────────────────────────────────────────

  it('marks all notifications as read', async () => {
    mockNotificationsApi.list.mockResolvedValue([
      makeNotif({ id: 'n1' }),
      makeNotif({ id: 'n2' }),
    ]);
    mockNotificationsApi.unreadCount.mockResolvedValue({ count: 2 } as any);
    mockNotificationsApi.markAllRead.mockResolvedValue(undefined as any);

    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.notifications).toHaveLength(2));

    await act(async () => { await result.current.markAllRead(); });

    expect(result.current.notifications.every((n) => n.isRead)).toBe(true);
    expect(result.current.unreadCount).toBe(0);
  });

  it('calls notificationsApi.markAllRead', async () => {
    mockNotificationsApi.markAllRead.mockResolvedValue(undefined as any);
    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.markAllRead(); });
    expect(mockNotificationsApi.markAllRead).toHaveBeenCalled();
  });

  // ── Socket events ────────────────────────────────────────────────────────

  it('registers "notification" socket listener on mount', async () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockSocket.on).toHaveBeenCalledWith('notification', expect.any(Function));
  });

  it('unregisters "notification" socket listener on unmount', async () => {
    const { result, unmount } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    unmount();
    expect(mockSocket.off).toHaveBeenCalledWith('notification', expect.any(Function));
  });

  it('prepends incoming socket notifications to the list', async () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const handler = mockSocket.on.mock.calls.find((c) => c[0] === 'notification')?.[1] as
      | ((n: ReturnType<typeof makeNotif>) => void)
      | undefined;

    const newNotif = makeNotif({ id: 'n99', title: 'New one' });
    act(() => { handler?.(newNotif); });

    expect(result.current.notifications[0].id).toBe('n99');
    expect(result.current.notifications).toHaveLength(2);
  });

  it('increments unreadCount when a new socket notification arrives', async () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const handler = mockSocket.on.mock.calls.find((c) => c[0] === 'notification')?.[1] as
      | ((n: ReturnType<typeof makeNotif>) => void)
      | undefined;

    act(() => { handler?.(makeNotif({ id: 'n99' })); });
    expect(result.current.unreadCount).toBe(2);
  });

  // ── refresh ──────────────────────────────────────────────────────────────

  it('refresh re-fetches notifications and unread count', async () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    mockNotificationsApi.list.mockResolvedValue([
      makeNotif({ id: 'n1' }),
      makeNotif({ id: 'n2' }),
    ]);
    mockNotificationsApi.unreadCount.mockResolvedValue({ count: 2 } as any);

    await act(async () => { await result.current.refresh(); });

    expect(result.current.notifications).toHaveLength(2);
    expect(result.current.unreadCount).toBe(2);
  });

  // ── Context shape ────────────────────────────────────────────────────────

  it('exposes the expected context shape', async () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current).toHaveProperty('notifications');
    expect(result.current).toHaveProperty('unreadCount');
    expect(result.current).toHaveProperty('isLoading');
    expect(result.current).toHaveProperty('markRead');
    expect(result.current).toHaveProperty('markAllRead');
    expect(result.current).toHaveProperty('refresh');
  });
});
