'use client';

import { useEffect, useRef, useState } from 'react';

export type SseStatus = 'connecting' | 'open' | 'closed' | 'error';

export interface SseResult<T> {
  data: T | null;
  status: SseStatus;
  error: Event | null;
  close: () => void;
}

/**
 * Generic hook for consuming a Server-Sent Events stream.
 *
 * Pass `null` as the URL to keep the connection closed (e.g. while the auth
 * token is not yet available).  The connection is automatically cleaned up
 * when the component unmounts or when the URL changes.
 *
 * @example
 * const { data, status } = useSse<MyPayload>(token
 *   ? `${API}/my-stream?token=${token}`
 *   : null
 * );
 */
export function useSse<T>(url: string | null): SseResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<SseStatus>('connecting');
  const [error, setError] = useState<Event | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!url) {
      setStatus('closed');
      return;
    }

    setStatus('connecting');
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => setStatus('open');

    es.onmessage = (event: MessageEvent<string>) => {
      try {
        setData(JSON.parse(event.data) as T);
      } catch {
        setData(event.data as unknown as T);
      }
    };

    es.onerror = (err) => {
      setError(err);
      setStatus('error');
    };

    return () => {
      es.close();
      esRef.current = null;
      setStatus('closed');
    };
  }, [url]);

  const close = () => {
    esRef.current?.close();
    setStatus('closed');
  };

  return { data, status, error, close };
}
