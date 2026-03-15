'use client';

import { useEffect, useState } from 'react';
import { WifiOff, Wifi, AlertTriangle, RotateCw } from 'lucide-react';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { cn } from '@/lib/utils';

type BannerState = 'offline' | 'slow' | 'reconnecting' | 'back-online' | 'hidden';

function useBannerState(): BannerState {
  const { isOnline, isSocketConnected, quality, isReconnecting } = useNetworkStatus();
  const [banner, setBanner] = useState<BannerState>('hidden');

  useEffect(() => {
    if (!isOnline || quality === 'offline') {
      setBanner('offline');
      return;
    }

    if (quality === 'slow') {
      setBanner('slow');
      return;
    }

    if (!isSocketConnected || isReconnecting) {
      if (banner === 'hidden') return;
      setBanner('reconnecting');
      return;
    }

    if (banner !== 'hidden') {
      setBanner('back-online');
      const t = setTimeout(() => setBanner('hidden'), 3000);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, isSocketConnected, quality, isReconnecting]);

  return banner;
}

export function NetworkStatusBanner() {
  const { reconnectAttempts } = useNetworkStatus();
  const state = useBannerState();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (state !== 'hidden') setMounted(true);
  }, [state]);

  if (!mounted) return null;

  const configs = {
    offline: {
      icon: <WifiOff className="h-4 w-4 shrink-0" />,
      message: "You're offline",
      sub: 'Check your connection',
      className: 'bg-zinc-900 text-white dark:bg-zinc-800',
    },
    slow: {
      icon: <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />,
      message: 'Slow connection',
      sub: 'Some features may load slowly',
      className: 'bg-zinc-900 text-white dark:bg-zinc-800',
    },
    reconnecting: {
      icon: <RotateCw className="h-4 w-4 shrink-0 animate-spin text-amber-400" />,
      message: reconnectAttempts > 0 ? `Reconnecting… (${reconnectAttempts})` : 'Reconnecting…',
      sub: 'Real-time updates paused',
      className: 'bg-zinc-900 text-white dark:bg-zinc-800',
    },
    'back-online': {
      icon: <Wifi className="h-4 w-4 shrink-0 text-emerald-400" />,
      message: 'Back online',
      sub: undefined,
      className: 'bg-zinc-900 text-white dark:bg-zinc-800',
    },
  } satisfies Record<
    Exclude<BannerState, 'hidden'>,
    { icon: React.ReactNode; message: string; sub: string | undefined; className: string }
  >;

  const cfg = configs[state as keyof typeof configs];
  if (!cfg) return null;

  const visible = state !== 'hidden';

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed bottom-5 left-5 z-9999 flex items-center gap-3 rounded-lg px-4 py-3 shadow-lg',
        'text-sm font-medium',
        'transition-all duration-300 ease-out',
        visible
          ? 'translate-y-0 opacity-100'
          : 'translate-y-4 opacity-0 pointer-events-none',
        cfg.className,
      )}
    >
      {cfg.icon}
      <div className="flex flex-col leading-tight">
        <span>{cfg.message}</span>
        {cfg.sub && (
          <span className="text-xs font-normal opacity-60">{cfg.sub}</span>
        )}
      </div>
    </div>
  );
}
