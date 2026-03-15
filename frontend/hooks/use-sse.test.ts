import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSse } from './use-sse';

// ── EventSource mock ─────────────────────────────────────────────────────────

class MockEventSource {
  static instances: MockEventSource[] = [];

  url: string;
  onopen: ((e: Event) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  close = vi.fn();

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }
}

beforeEach(() => {
  MockEventSource.instances = [];
  // @ts-expect-error – replacing global for tests
  global.EventSource = MockEventSource;
});

describe('useSse', () => {
  it('returns "closed" status and null data when url is null', () => {
    const { result } = renderHook(() => useSse(null));
    expect(result.current.status).toBe('closed');
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('creates an EventSource for a valid url', () => {
    renderHook(() => useSse('http://test.com/sse'));
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toBe('http://test.com/sse');
  });

  it('starts in "connecting" status when a url is given', () => {
    const { result } = renderHook(() => useSse('http://test.com/sse'));
    expect(result.current.status).toBe('connecting');
  });

  it('sets status to "open" when onopen fires', () => {
    const { result } = renderHook(() => useSse('http://test.com/sse'));
    act(() => {
      MockEventSource.instances[0].onopen?.(new Event('open'));
    });
    expect(result.current.status).toBe('open');
  });

  it('parses JSON data from onmessage', () => {
    const { result } = renderHook(() => useSse<{ value: number }>('http://test.com/sse'));
    act(() => {
      MockEventSource.instances[0].onmessage?.(
        new MessageEvent('message', { data: JSON.stringify({ value: 42 }) }),
      );
    });
    expect(result.current.data).toEqual({ value: 42 });
  });

  it('falls back to raw string when data is not valid JSON', () => {
    const { result } = renderHook(() => useSse<string>('http://test.com/sse'));
    act(() => {
      MockEventSource.instances[0].onmessage?.(
        new MessageEvent('message', { data: 'plain-text' }),
      );
    });
    expect(result.current.data).toBe('plain-text');
  });

  it('sets status to "error" and captures the event on onerror', () => {
    const { result } = renderHook(() => useSse('http://test.com/sse'));
    const errEvent = new Event('error');
    act(() => {
      MockEventSource.instances[0].onerror?.(errEvent);
    });
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe(errEvent);
  });

  it('closes the EventSource on unmount', () => {
    const { unmount } = renderHook(() => useSse('http://test.com/sse'));
    const es = MockEventSource.instances[0];
    unmount();
    expect(es.close).toHaveBeenCalled();
  });

  it('closes the old EventSource and creates a new one when url changes', () => {
    const { rerender } = renderHook(({ url }) => useSse(url), {
      initialProps: { url: 'http://a.com/sse' },
    });
    const first = MockEventSource.instances[0];
    rerender({ url: 'http://b.com/sse' });
    expect(first.close).toHaveBeenCalled();
    expect(MockEventSource.instances).toHaveLength(2);
    expect(MockEventSource.instances[1].url).toBe('http://b.com/sse');
  });

  it('transitions from url→null closes the connection', () => {
    const { result, rerender } = renderHook(
      ({ url }: { url: string | null }) => useSse(url),
      { initialProps: { url: 'http://test.com/sse' as string | null } },
    );
    const es = MockEventSource.instances[0];
    rerender({ url: null });
    expect(es.close).toHaveBeenCalled();
    expect(result.current.status).toBe('closed');
  });

  it('close() function closes the connection manually', () => {
    const { result } = renderHook(() => useSse('http://test.com/sse'));
    const es = MockEventSource.instances[0];
    act(() => {
      result.current.close();
    });
    expect(es.close).toHaveBeenCalled();
    expect(result.current.status).toBe('closed');
  });
});
