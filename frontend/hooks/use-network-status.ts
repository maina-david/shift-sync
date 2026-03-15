'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { getSocket } from '@/lib/socket';

export type ConnectionQuality = 'offline' | 'slow' | 'online';

export interface NetworkStatus {
  /** Browser reports network connectivity */
  isOnline: boolean;
  /** WebSocket is actively connected to the server */
  isSocketConnected: boolean;
  /** Coarse connection quality from navigator.connection (if available) */
  quality: ConnectionQuality;
  /** True while socket is attempting to reconnect after a disconnect */
  isReconnecting: boolean;
  /** Number of reconnection attempts since the last disconnect */
  reconnectAttempts: number;
}

const SLOW_TYPES = new Set(['slow-2g', '2g']);

function getQuality(isOnline: boolean): ConnectionQuality {
  if (!isOnline) return 'offline';
  const conn = (navigator as any).connection ?? (navigator as any).mozConnection ?? (navigator as any).webkitConnection;
  if (conn && SLOW_TYPES.has(conn.effectiveType)) return 'slow';
  return 'online';
}

export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [quality, setQuality] = useState<ConnectionQuality>(() =>
    typeof navigator !== 'undefined' ? getQuality(navigator.onLine) : 'online',
  );

  // Keep a ref so socket handlers don't close over stale state
  const attemptsRef = useRef(0);

  const refreshQuality = useCallback(() => {
    setQuality(getQuality(navigator.onLine));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // ── Browser online/offline ────────────────────────────────────────────────
    const handleOnline = () => {
      setIsOnline(true);
      refreshQuality();
    };
    const handleOffline = () => {
      setIsOnline(false);
      setQuality('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // ── navigator.connection quality changes ──────────────────────────────────
    const conn = (navigator as any).connection ?? (navigator as any).mozConnection ?? (navigator as any).webkitConnection;
    conn?.addEventListener('change', refreshQuality);

    // ── Socket.io events ──────────────────────────────────────────────────────
    const socket = getSocket();

    const onConnect = () => {
      setIsSocketConnected(true);
      setIsReconnecting(false);
      attemptsRef.current = 0;
      setReconnectAttempts(0);
    };
    const onDisconnect = () => {
      setIsSocketConnected(false);
    };
    const onReconnectAttempt = () => {
      setIsReconnecting(true);
      attemptsRef.current += 1;
      setReconnectAttempts(attemptsRef.current);
    };
    const onReconnectFailed = () => {
      setIsReconnecting(false);
    };

    // Seed initial socket state
    setIsSocketConnected(socket.connected);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.io.on('reconnect_attempt', onReconnectAttempt);
    socket.io.on('reconnect_failed', onReconnectFailed);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      conn?.removeEventListener('change', refreshQuality);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.io.off('reconnect_attempt', onReconnectAttempt);
      socket.io.off('reconnect_failed', onReconnectFailed);
    };
  }, [refreshQuality]);

  return { isOnline, isSocketConnected, quality, isReconnecting, reconnectAttempts };
}
