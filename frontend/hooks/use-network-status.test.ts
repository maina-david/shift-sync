import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNetworkStatus } from './use-network-status';

const mockIo = { on: vi.fn(), off: vi.fn() };
const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  connected: false,
  io: mockIo,
};

vi.mock('@/lib/socket', () => ({
  getSocket: () => mockSocket,
}));

describe('useNetworkStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', { writable: true, value: true });
    mockSocket.connected = false;
  });

  // ── Initial state ────────────────────────────────────────────────────────

  it('reflects navigator.onLine === true', () => {
    Object.defineProperty(navigator, 'onLine', { writable: true, value: true });
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.isOnline).toBe(true);
  });

  it('reflects navigator.onLine === false', () => {
    Object.defineProperty(navigator, 'onLine', { writable: true, value: false });
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.isOnline).toBe(false);
  });

  it('seeds isSocketConnected from socket.connected', () => {
    mockSocket.connected = true;
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.isSocketConnected).toBe(true);
  });

  it('starts with reconnectAttempts at 0', () => {
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.reconnectAttempts).toBe(0);
  });

  it('starts not reconnecting', () => {
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.isReconnecting).toBe(false);
  });

  it('initial quality is "online" when online', () => {
    Object.defineProperty(navigator, 'onLine', { writable: true, value: true });
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.quality).toBe('online');
  });

  it('initial quality is "offline" when offline', () => {
    Object.defineProperty(navigator, 'onLine', { writable: true, value: false });
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.quality).toBe('offline');
  });

  // ── Browser online/offline events ─────────────────────────────────────────

  it('sets isOnline to false when "offline" event fires', () => {
    const { result } = renderHook(() => useNetworkStatus());
    act(() => { window.dispatchEvent(new Event('offline')); });
    expect(result.current.isOnline).toBe(false);
  });

  it('sets quality to "offline" when "offline" event fires', () => {
    const { result } = renderHook(() => useNetworkStatus());
    act(() => { window.dispatchEvent(new Event('offline')); });
    expect(result.current.quality).toBe('offline');
  });

  it('sets isOnline to true when "online" event fires', () => {
    Object.defineProperty(navigator, 'onLine', { writable: true, value: false });
    const { result } = renderHook(() => useNetworkStatus());
    act(() => {
      Object.defineProperty(navigator, 'onLine', { writable: true, value: true });
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current.isOnline).toBe(true);
  });

  // ── Socket events ────────────────────────────────────────────────────────

  it('registers socket event handlers', () => {
    renderHook(() => useNetworkStatus());
    expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    expect(mockIo.on).toHaveBeenCalledWith('reconnect_attempt', expect.any(Function));
    expect(mockIo.on).toHaveBeenCalledWith('reconnect_failed', expect.any(Function));
  });

  it('sets isSocketConnected to true on socket "connect"', () => {
    const { result } = renderHook(() => useNetworkStatus());
    const connectHandler = mockSocket.on.mock.calls.find((c) => c[0] === 'connect')?.[1] as () => void;
    act(() => { connectHandler(); });
    expect(result.current.isSocketConnected).toBe(true);
  });

  it('sets isSocketConnected to false on socket "disconnect"', () => {
    mockSocket.connected = true;
    const { result } = renderHook(() => useNetworkStatus());
    const disconnectHandler = mockSocket.on.mock.calls.find((c) => c[0] === 'disconnect')?.[1] as () => void;
    act(() => { disconnectHandler(); });
    expect(result.current.isSocketConnected).toBe(false);
  });

  it('increments reconnectAttempts on each reconnect_attempt', () => {
    const { result } = renderHook(() => useNetworkStatus());
    const attemptHandler = mockIo.on.mock.calls.find((c) => c[0] === 'reconnect_attempt')?.[1] as () => void;
    act(() => { attemptHandler(); });
    act(() => { attemptHandler(); });
    expect(result.current.reconnectAttempts).toBe(2);
  });

  it('sets isReconnecting to true on reconnect_attempt', () => {
    const { result } = renderHook(() => useNetworkStatus());
    const attemptHandler = mockIo.on.mock.calls.find((c) => c[0] === 'reconnect_attempt')?.[1] as () => void;
    act(() => { attemptHandler(); });
    expect(result.current.isReconnecting).toBe(true);
  });

  it('resets reconnectAttempts and isReconnecting on socket "connect"', () => {
    const { result } = renderHook(() => useNetworkStatus());
    const attemptHandler = mockIo.on.mock.calls.find((c) => c[0] === 'reconnect_attempt')?.[1] as () => void;
    const connectHandler = mockSocket.on.mock.calls.find((c) => c[0] === 'connect')?.[1] as () => void;
    act(() => { attemptHandler(); attemptHandler(); });
    act(() => { connectHandler(); });
    expect(result.current.reconnectAttempts).toBe(0);
    expect(result.current.isReconnecting).toBe(false);
  });

  it('sets isReconnecting to false on reconnect_failed', () => {
    const { result } = renderHook(() => useNetworkStatus());
    const attemptHandler = mockIo.on.mock.calls.find((c) => c[0] === 'reconnect_attempt')?.[1] as () => void;
    const failedHandler = mockIo.on.mock.calls.find((c) => c[0] === 'reconnect_failed')?.[1] as () => void;
    act(() => { attemptHandler(); });
    act(() => { failedHandler(); });
    expect(result.current.isReconnecting).toBe(false);
  });

  // ── Cleanup ──────────────────────────────────────────────────────────────

  it('removes window event listeners on unmount', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useNetworkStatus());
    unmount();
    const addedEvents = addSpy.mock.calls.map((c) => c[0]);
    const removedEvents = removeSpy.mock.calls.map((c) => c[0]);
    expect(addedEvents).toContain('online');
    expect(addedEvents).toContain('offline');
    expect(removedEvents).toContain('online');
    expect(removedEvents).toContain('offline');
  });

  it('removes socket listeners on unmount', () => {
    const { unmount } = renderHook(() => useNetworkStatus());
    unmount();
    expect(mockSocket.off).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('disconnect', expect.any(Function));
    expect(mockIo.off).toHaveBeenCalledWith('reconnect_attempt', expect.any(Function));
    expect(mockIo.off).toHaveBeenCalledWith('reconnect_failed', expect.any(Function));
  });
});
