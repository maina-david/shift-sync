import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './auth-context';
import { authApi, setAccessToken } from '@/lib/api';
import { disconnectSocket, reconnectSocket } from '@/lib/socket';

const mockPush = vi.fn();
const mockRouter = { push: mockPush };

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

vi.mock('@/lib/api', () => ({
  authApi: {
    refresh: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    me: vi.fn(),
  },
  setAccessToken: vi.fn(),
  getAccessToken: vi.fn(() => null),
}));

vi.mock('@/lib/socket', () => ({
  disconnectSocket: vi.fn(),
  reconnectSocket: vi.fn(),
  getSocket: vi.fn(() => ({ on: vi.fn(), off: vi.fn() })),
}));

const mockAuthApi = vi.mocked(authApi);

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('useAuth', () => {
  it('throws when called outside AuthProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth must be used within AuthProvider',
    );
    spy.mockRestore();
  });
});

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Bootstrap (mount) ────────────────────────────────────────────────────

  it('starts in loading state', () => {
    mockAuthApi.refresh.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
  });

  it('sets user and token when bootstrap refresh succeeds', async () => {
    const fakeUser = { id: 'u1', name: 'Alice', role: 'staff' };
    mockAuthApi.refresh.mockResolvedValue({ token: 'access-tok', user: fakeUser });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.user).toEqual(fakeUser);
    expect(result.current.token).toBe('access-tok');
    expect(setAccessToken).toHaveBeenCalledWith('access-tok');
    expect(reconnectSocket).toHaveBeenCalled();
  });

  it('leaves user null when bootstrap refresh fails', async () => {
    mockAuthApi.refresh.mockRejectedValue(new Error('No session'));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(setAccessToken).toHaveBeenCalledWith(null);
  });

  it('finishes loading after bootstrap regardless of outcome', async () => {
    mockAuthApi.refresh.mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  // ── login ────────────────────────────────────────────────────────────────

  it('sets user and token after successful login', async () => {
    mockAuthApi.refresh.mockRejectedValue(new Error('No session'));
    const fakeUser = { id: 'u2', name: 'Bob', role: 'manager' };
    mockAuthApi.login.mockResolvedValue({ token: 'login-tok', user: fakeUser });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.login('bob@test.com', 'password');
    });

    expect(result.current.user).toEqual(fakeUser);
    expect(result.current.token).toBe('login-tok');
    expect(setAccessToken).toHaveBeenCalledWith('login-tok');
    expect(reconnectSocket).toHaveBeenCalled();
  });

  it('propagates errors thrown by authApi.login', async () => {
    mockAuthApi.refresh.mockRejectedValue(new Error('No session'));
    mockAuthApi.login.mockRejectedValue(new Error('Bad credentials'));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(
      act(async () => { await result.current.login('x@x.com', 'bad'); }),
    ).rejects.toThrow('Bad credentials');
  });

  // ── logout ───────────────────────────────────────────────────────────────

  it('clears user and token on logout', async () => {
    const fakeUser = { id: 'u1', name: 'Alice', role: 'staff' };
    mockAuthApi.refresh.mockResolvedValueOnce({ token: 'tok', user: fakeUser });
    mockAuthApi.logout.mockResolvedValue(undefined);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user).toBeTruthy());

    await act(async () => { result.current.logout(); });

    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(setAccessToken).toHaveBeenLastCalledWith(null);
  });

  it('disconnects the socket on logout', async () => {
    const fakeUser = { id: 'u1', name: 'Alice', role: 'staff' };
    mockAuthApi.refresh.mockResolvedValueOnce({ token: 'tok', user: fakeUser });
    mockAuthApi.logout.mockResolvedValue(undefined);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user).toBeTruthy());

    await act(async () => { result.current.logout(); });
    expect(disconnectSocket).toHaveBeenCalled();
  });

  it('redirects to /login on logout', async () => {
    const fakeUser = { id: 'u1', name: 'Alice', role: 'staff' };
    mockAuthApi.refresh.mockResolvedValueOnce({ token: 'tok', user: fakeUser });
    mockAuthApi.logout.mockResolvedValue(undefined);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user).toBeTruthy());

    await act(async () => { result.current.logout(); });
    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  // ── refreshUser ──────────────────────────────────────────────────────────

  it('refreshUser updates the user from /me', async () => {
    const initial = { id: 'u1', name: 'Alice', role: 'staff' };
    const updated = { id: 'u1', name: 'Alice Updated', role: 'manager' };
    mockAuthApi.refresh.mockResolvedValue({ token: 'tok', user: initial });
    mockAuthApi.me.mockResolvedValue(updated);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user).toEqual(initial));

    await act(async () => { await result.current.refreshUser(); });
    expect(result.current.user).toEqual(updated);
  });

  it('calls logout when refreshUser fails', async () => {
    const fakeUser = { id: 'u1', name: 'Alice', role: 'staff' };
    mockAuthApi.refresh.mockResolvedValueOnce({ token: 'tok', user: fakeUser });
    mockAuthApi.logout.mockResolvedValue(undefined);
    mockAuthApi.me.mockRejectedValue(new Error('Unauthorized'));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user).toBeTruthy());

    await act(async () => { await result.current.refreshUser(); });
    expect(result.current.user).toBeNull();
    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  // ── Context values ───────────────────────────────────────────────────────

  it('exposes the expected shape from useAuth()', async () => {
    mockAuthApi.refresh.mockRejectedValue(new Error('No session'));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current).toHaveProperty('user');
    expect(result.current).toHaveProperty('token');
    expect(result.current).toHaveProperty('isLoading');
    expect(result.current).toHaveProperty('login');
    expect(result.current).toHaveProperty('logout');
    expect(result.current).toHaveProperty('refreshUser');
  });
});
