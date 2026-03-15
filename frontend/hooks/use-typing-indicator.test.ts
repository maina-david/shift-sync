import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTypingIndicator } from './use-typing-indicator';

const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
};

vi.mock('@/lib/socket', () => ({
  getSocket: () => mockSocket,
}));

describe('useTypingIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Initial state ────────────────────────────────────────────────────────

  it('isPartnerTyping is false initially', () => {
    const { result } = renderHook(() => useTypingIndicator('partner-1'));
    expect(result.current.isPartnerTyping).toBe(false);
  });

  it('does not register socket listeners when partnerId is null', () => {
    renderHook(() => useTypingIndicator(null));
    expect(mockSocket.on).not.toHaveBeenCalled();
  });

  it('does not register socket listeners when partnerId is undefined', () => {
    renderHook(() => useTypingIndicator(undefined));
    expect(mockSocket.on).not.toHaveBeenCalled();
  });

  // ── Socket listener registration ─────────────────────────────────────────

  it('registers typing:start and typing:stop listeners', () => {
    renderHook(() => useTypingIndicator('partner-1'));
    expect(mockSocket.on).toHaveBeenCalledWith('typing:start', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('typing:stop', expect.any(Function));
  });

  it('removes socket listeners on unmount', () => {
    const { unmount } = renderHook(() => useTypingIndicator('partner-1'));
    unmount();
    expect(mockSocket.off).toHaveBeenCalledWith('typing:start', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('typing:stop', expect.any(Function));
  });

  // ── Incoming typing events ────────────────────────────────────────────────

  it('sets isPartnerTyping to true when typing:start is received from partner', () => {
    const { result } = renderHook(() => useTypingIndicator('partner-1'));
    const startHandler = mockSocket.on.mock.calls.find((c) => c[0] === 'typing:start')?.[1] as (p: { userId: string }) => void;

    act(() => {
      startHandler({ userId: 'partner-1' });
    });

    expect(result.current.isPartnerTyping).toBe(true);
  });

  it('ignores typing:start from a different user', () => {
    const { result } = renderHook(() => useTypingIndicator('partner-1'));
    const startHandler = mockSocket.on.mock.calls.find((c) => c[0] === 'typing:start')?.[1] as (p: { userId: string }) => void;

    act(() => {
      startHandler({ userId: 'other-user' });
    });

    expect(result.current.isPartnerTyping).toBe(false);
  });

  it('clears isPartnerTyping when typing:stop is received from partner', () => {
    const { result } = renderHook(() => useTypingIndicator('partner-1'));
    const startHandler = mockSocket.on.mock.calls.find((c) => c[0] === 'typing:start')?.[1] as (p: { userId: string }) => void;
    const stopHandler = mockSocket.on.mock.calls.find((c) => c[0] === 'typing:stop')?.[1] as (p: { userId: string }) => void;

    act(() => { startHandler({ userId: 'partner-1' }); });
    expect(result.current.isPartnerTyping).toBe(true);

    act(() => { stopHandler({ userId: 'partner-1' }); });
    expect(result.current.isPartnerTyping).toBe(false);
  });

  it('auto-clears isPartnerTyping after 4 seconds (safety timeout)', () => {
    const { result } = renderHook(() => useTypingIndicator('partner-1'));
    const startHandler = mockSocket.on.mock.calls.find((c) => c[0] === 'typing:start')?.[1] as (p: { userId: string }) => void;

    act(() => { startHandler({ userId: 'partner-1' }); });
    expect(result.current.isPartnerTyping).toBe(true);

    act(() => { vi.advanceTimersByTime(4000); });
    expect(result.current.isPartnerTyping).toBe(false);
  });

  it('resets the 4s safety timeout on each new typing:start from partner', () => {
    const { result } = renderHook(() => useTypingIndicator('partner-1'));
    const startHandler = mockSocket.on.mock.calls.find((c) => c[0] === 'typing:start')?.[1] as (p: { userId: string }) => void;

    act(() => { startHandler({ userId: 'partner-1' }); });
    act(() => { vi.advanceTimersByTime(3000); }); // almost expired

    act(() => { startHandler({ userId: 'partner-1' }); }); // reset
    act(() => { vi.advanceTimersByTime(3000); }); // would have expired but was reset
    expect(result.current.isPartnerTyping).toBe(true); // still typing

    act(() => { vi.advanceTimersByTime(1100); }); // now actually 4s since last event
    expect(result.current.isPartnerTyping).toBe(false);
  });

  // ── Outgoing typing events ────────────────────────────────────────────────

  it('onKeyStroke emits typing:start on the first keystroke', () => {
    const { result } = renderHook(() => useTypingIndicator('partner-1'));
    act(() => { result.current.onKeyStroke('recipient-1'); });
    expect(mockSocket.emit).toHaveBeenCalledWith('typing:start', 'recipient-1');
  });

  it('onKeyStroke does not re-emit typing:start on subsequent keystrokes', () => {
    const { result } = renderHook(() => useTypingIndicator('partner-1'));
    act(() => { result.current.onKeyStroke('recipient-1'); });
    act(() => { result.current.onKeyStroke('recipient-1'); });
    act(() => { result.current.onKeyStroke('recipient-1'); });
    const startCalls = mockSocket.emit.mock.calls.filter((c) => c[0] === 'typing:start');
    expect(startCalls).toHaveLength(1);
  });

  it('auto-emits typing:stop after 2 seconds of silence', () => {
    const { result } = renderHook(() => useTypingIndicator('partner-1'));
    act(() => { result.current.onKeyStroke('recipient-1'); });
    act(() => { vi.advanceTimersByTime(2000); });
    expect(mockSocket.emit).toHaveBeenCalledWith('typing:stop', 'recipient-1');
  });

  it('resets the 2s auto-stop timer on each keystroke', () => {
    const { result } = renderHook(() => useTypingIndicator('partner-1'));
    act(() => { result.current.onKeyStroke('recipient-1'); });
    act(() => { vi.advanceTimersByTime(1500); });
    act(() => { result.current.onKeyStroke('recipient-1'); }); // reset
    act(() => { vi.advanceTimersByTime(1500); });
    // Timer was reset so stop should NOT have fired yet
    const stopCalls = mockSocket.emit.mock.calls.filter((c) => c[0] === 'typing:stop');
    expect(stopCalls).toHaveLength(0);

    act(() => { vi.advanceTimersByTime(600); }); // total 2100ms since last reset
    expect(mockSocket.emit).toHaveBeenCalledWith('typing:stop', 'recipient-1');
  });

  it('after auto-stop, next keystroke emits typing:start again', () => {
    const { result } = renderHook(() => useTypingIndicator('partner-1'));
    act(() => { result.current.onKeyStroke('recipient-1'); });
    act(() => { vi.advanceTimersByTime(2000); }); // auto-stop fires

    act(() => { result.current.onKeyStroke('recipient-1'); }); // new session
    const startCalls = mockSocket.emit.mock.calls.filter((c) => c[0] === 'typing:start');
    expect(startCalls).toHaveLength(2);
  });

  it('onStopTyping emits typing:stop immediately when active', () => {
    const { result } = renderHook(() => useTypingIndicator('partner-1'));
    act(() => { result.current.onKeyStroke('recipient-1'); }); // start emitting
    act(() => { result.current.onStopTyping('recipient-1'); });
    const stopCalls = mockSocket.emit.mock.calls.filter((c) => c[0] === 'typing:stop');
    expect(stopCalls).toHaveLength(1);
  });

  it('onStopTyping is a no-op when not currently emitting', () => {
    const { result } = renderHook(() => useTypingIndicator('partner-1'));
    act(() => { result.current.onStopTyping('recipient-1'); });
    expect(mockSocket.emit).not.toHaveBeenCalled();
  });
});
