import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIsMobile } from './use-mobile';

describe('useIsMobile', () => {
  type ChangeListener = (e: { matches: boolean }) => void;
  let listeners: ChangeListener[];
  let mqlMock: {
    matches: boolean;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    listeners = [];
    mqlMock = {
      matches: false,
      addEventListener: vi.fn((_: string, cb: ChangeListener) => listeners.push(cb)),
      removeEventListener: vi.fn(),
    };
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn(() => mqlMock),
    });
  });

  it('returns false for a desktop viewport (>= 768px)', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 });
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it('returns true for a mobile viewport (< 768px)', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 375 });
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('returns false exactly at 768px', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 768 });
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it('returns true at 767px', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 767 });
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('updates when viewport crosses the 768px threshold', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 });
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 375 });
      listeners.forEach((cb) => cb({ matches: true }));
    });

    expect(result.current).toBe(true);
  });

  it('removes the media query listener on unmount', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 });
    const { unmount } = renderHook(() => useIsMobile());
    unmount();
    expect(mqlMock.removeEventListener).toHaveBeenCalled();
  });

  it('registers a listener for media query changes', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 });
    renderHook(() => useIsMobile());
    expect(mqlMock.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });
});
