import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MessagesProvider, useMessages } from './messages-context';
import { messagesApi, usersApi } from '@/lib/api';
import { useAuth } from './auth-context';

const mockSocket = { on: vi.fn(), off: vi.fn(), emit: vi.fn() };

vi.mock('@/lib/socket', () => ({ getSocket: () => mockSocket }));

vi.mock('./auth-context', () => ({ useAuth: vi.fn() }));

vi.mock('@/lib/api', () => ({
  messagesApi: {
    getInbox: vi.fn(),
    getThread: vi.fn(),
    send: vi.fn(),
    markRead: vi.fn(),
  },
  usersApi: { directory: vi.fn() },
  setAccessToken: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));

const mockUseAuth = vi.mocked(useAuth);
const mockMessagesApi = vi.mocked(messagesApi);
const mockUsersApi = vi.mocked(usersApi);

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MessagesProvider>{children}</MessagesProvider>
    </QueryClientProvider>
  );
}

const makeMsg = (overrides: Record<string, unknown> = {}) => ({
  id: 'm1',
  type: 'direct',
  senderId: 'other',
  recipientId: 'me',
  isRead: false,
  body: 'Hello',
  createdAt: new Date().toISOString(),
  sender: { id: 'other', name: 'Other User', role: 'staff' },
  recipient: { id: 'me', name: 'Me', role: 'staff' },
  locationId: null,
  ...overrides,
});

describe('useMessages', () => {
  it('throws when called outside MessagesProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useMessages())).toThrow(
      'useMessages must be used within MessagesProvider',
    );
    spy.mockRestore();
  });
});

describe('MessagesProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: 'me', name: 'Me', role: 'staff' } } as any);
    mockMessagesApi.getInbox.mockResolvedValue({ threads: [], announcements: [] } as any);
    mockMessagesApi.getThread.mockResolvedValue([]);
    mockUsersApi.directory.mockResolvedValue([]);
  });

  // ── Initial state ────────────────────────────────────────────────────────

  it('provides empty inbox initially', async () => {
    const { result } = renderHook(() => useMessages(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.inbox).toEqual([]);
  });

  it('provides empty announcements initially', async () => {
    const { result } = renderHook(() => useMessages(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.announcements).toEqual([]);
  });

  it('provides empty partners list initially', async () => {
    const { result } = renderHook(() => useMessages(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.partners).toEqual([]);
  });

  it('starts with no selected user', async () => {
    const { result } = renderHook(() => useMessages(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.selectedUserId).toBeNull();
    expect(result.current.selectedUser).toBeNull();
  });

  // ── selectUser / clearSelection ──────────────────────────────────────────

  it('selectUser sets selectedUserId', async () => {
    const { result } = renderHook(() => useMessages(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => { result.current.selectUser('user-42'); });
    expect(result.current.selectedUserId).toBe('user-42');
  });

  it('clearSelection resets selectedUserId to null', async () => {
    const { result } = renderHook(() => useMessages(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => { result.current.selectUser('user-42'); });
    act(() => { result.current.clearSelection(); });
    expect(result.current.selectedUserId).toBeNull();
  });

  // ── Partners and unreadCount ─────────────────────────────────────────────

  it('derives partners from inbox threads', async () => {
    mockMessagesApi.getInbox.mockResolvedValue({
      threads: [makeMsg()],
      announcements: [],
    } as any);
    const { result } = renderHook(() => useMessages(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.partners).toHaveLength(1));
    expect(result.current.partners[0].id).toBe('other');
  });

  it('counts unread threads in unreadCount', async () => {
    mockMessagesApi.getInbox.mockResolvedValue({
      threads: [makeMsg({ isRead: false, recipientId: 'me' })],
      announcements: [],
    } as any);
    const { result } = renderHook(() => useMessages(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.unreadCount).toBe(1));
  });

  it('does not count read messages in unreadCount', async () => {
    mockMessagesApi.getInbox.mockResolvedValue({
      threads: [makeMsg({ isRead: true, recipientId: 'me' })],
      announcements: [],
    } as any);
    const { result } = renderHook(() => useMessages(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.unreadCount).toBe(0);
  });

  // ── staffList ────────────────────────────────────────────────────────────

  it('populates staffList from usersApi.directory', async () => {
    mockUsersApi.directory.mockResolvedValue([
      { id: 'u1', name: 'Staff A', role: 'staff' },
    ]);
    const { result } = renderHook(() => useMessages(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.staffList).toHaveLength(1));
    expect(result.current.staffList[0].name).toBe('Staff A');
  });

  // ── selectedUser resolution ──────────────────────────────────────────────

  it('resolves selectedUser from staffList when user is selected', async () => {
    mockUsersApi.directory.mockResolvedValue([
      { id: 'u1', name: 'Staff A', role: 'staff' },
    ]);
    const { result } = renderHook(() => useMessages(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.staffList).toHaveLength(1));
    act(() => { result.current.selectUser('u1'); });
    expect(result.current.selectedUser?.name).toBe('Staff A');
  });

  // ── WebSocket integration ────────────────────────────────────────────────

  it('registers "message:new" socket listener on mount', async () => {
    const { result } = renderHook(() => useMessages(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockSocket.on).toHaveBeenCalledWith('message:new', expect.any(Function));
  });

  it('removes "message:new" socket listener on unmount', async () => {
    const { result, unmount } = renderHook(() => useMessages(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    unmount();
    expect(mockSocket.off).toHaveBeenCalledWith('message:new', expect.any(Function));
  });

  it('does not register socket listener when user is null', async () => {
    mockUseAuth.mockReturnValue({ user: null } as any);
    renderHook(() => useMessages(), { wrapper: makeWrapper() });
    await new Promise((r) => setTimeout(r, 50));
    const msgNewCalls = mockSocket.on.mock.calls.filter((c) => c[0] === 'message:new');
    expect(msgNewCalls).toHaveLength(0);
  });

  // ── Context shape ────────────────────────────────────────────────────────

  it('exposes the expected context shape', async () => {
    const { result } = renderHook(() => useMessages(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current).toHaveProperty('inbox');
    expect(result.current).toHaveProperty('announcements');
    expect(result.current).toHaveProperty('partners');
    expect(result.current).toHaveProperty('unreadCount');
    expect(result.current).toHaveProperty('staffList');
    expect(result.current).toHaveProperty('selectedUserId');
    expect(result.current).toHaveProperty('selectedUser');
    expect(result.current).toHaveProperty('selectUser');
    expect(result.current).toHaveProperty('clearSelection');
    expect(result.current).toHaveProperty('thread');
    expect(result.current).toHaveProperty('threadLoading');
    expect(result.current).toHaveProperty('send');
    expect(result.current).toHaveProperty('isSending');
    expect(result.current).toHaveProperty('markRead');
  });
});
