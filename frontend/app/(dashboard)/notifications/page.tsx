'use client';

import { useState, useMemo } from 'react';
import { format, isToday, isYesterday, isThisWeek } from 'date-fns';
import {
  Bell,
  BellOff,
  CheckCheck,
  AlertTriangle,
  Info,
  RefreshCw,
  Check,
} from 'lucide-react';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useNotifications } from '@/contexts/notifications-context';
import { Notification } from '@/lib/types';
import { cn } from '@/lib/utils';

// ─── Tier helpers ─────────────────────────────────────────────────────────────

const CRITICAL_TYPES = ['SHIFT_UNCOVERED', 'UNCOVERED_SHIFT', 'SHIFT_CANCELLED', 'CERT_EXPIRY_WARNING'];
const INFO_TYPES = ['WEEKLY_SUMMARY', 'REPORT_READY'];

function tier(type: string): 'critical' | 'info' | 'standard' {
  const t = type?.toUpperCase() ?? '';
  if (CRITICAL_TYPES.some((k) => t.includes(k))) return 'critical';
  if (INFO_TYPES.some((k) => t.includes(k))) return 'info';
  return 'standard';
}

function dateGroup(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  if (isThisWeek(d)) return 'This week';
  return 'Earlier';
}

// ─── Icon ─────────────────────────────────────────────────────────────────────

function NotifIcon({ type, isRead }: { type: string; isRead: boolean }) {
  const t = tier(type);
  if (t === 'critical') {
    return (
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
        isRead ? 'bg-destructive/10' : 'bg-destructive/15',
      )}>
        <AlertTriangle className="h-4 w-4 text-destructive" />
      </div>
    );
  }
  if (t === 'info') {
    return (
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
        isRead ? 'bg-blue-500/10' : 'bg-blue-500/15',
      )}>
        <Info className="h-4 w-4 text-blue-500" />
      </div>
    );
  }
  return (
    <div className={cn(
      'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
      isRead ? 'bg-primary/8' : 'bg-primary/15',
    )}>
      <Bell className="h-4 w-4 text-primary" />
    </div>
  );
}

// ─── Accent bar ───────────────────────────────────────────────────────────────

function accentClass(t: 'critical' | 'info' | 'standard') {
  if (t === 'critical') return 'border-l-destructive';
  if (t === 'info') return 'border-l-blue-500';
  return 'border-l-primary';
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'unread' | 'critical';

export default function NotificationsPage() {
  const { notifications, unreadCount, isLoading, markRead, markAllRead } = useNotifications();
  const [tab, setTab] = useState<FilterTab>('all');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const criticalCount = useMemo(
    () => notifications.filter((n) => !n.isRead && tier(n.type) === 'critical').length,
    [notifications],
  );

  const filtered = useMemo(() => {
    if (tab === 'unread') return notifications.filter((n) => !n.isRead);
    if (tab === 'critical') return notifications.filter((n) => tier(n.type) === 'critical');
    return notifications;
  }, [notifications, tab]);

  // Group by date label
  const groups = useMemo(() => {
    const order = ['Today', 'Yesterday', 'This week', 'Earlier'];
    const map = new Map<string, Notification[]>();
    for (const n of filtered) {
      const g = dateGroup(n.createdAt);
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(n);
    }
    return order.filter((g) => map.has(g)).map((g) => ({ label: g, items: map.get(g)! }));
  }, [filtered]);

  const tabs: { id: FilterTab; label: string; count?: number }[] = [
    { id: 'all', label: 'All', count: notifications.length },
    { id: 'unread', label: 'Unread', count: unreadCount || undefined },
    { id: 'critical', label: 'Critical', count: criticalCount || undefined },
  ];

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
              : 'All caught up — no unread notifications'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead} className="shrink-0">
            <CheckCheck className="h-4 w-4 mr-2" />
            Mark all read
          </Button>
        )}
      </div>

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground font-medium">Total</p>
          <p className="text-2xl font-bold mt-0.5">{notifications.length}</p>
        </div>
        <div className="rounded-lg border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground font-medium">Unread</p>
          <p className={cn('text-2xl font-bold mt-0.5', unreadCount > 0 && 'text-primary')}>
            {unreadCount}
          </p>
        </div>
        <div className="rounded-lg border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground font-medium">Critical</p>
          <p className={cn('text-2xl font-bold mt-0.5', criticalCount > 0 && 'text-destructive')}>
            {criticalCount}
          </p>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 border-b pb-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <Badge
                variant={tab === t.id ? 'default' : 'secondary'}
                className="h-4 px-1.5 text-[0.6rem] font-semibold"
              >
                {t.count}
              </Badge>
            )}
          </button>
        ))}
      </div>

      {/* ── Body ── */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-18 w-full rounded-lg" />)}
        </div>
      ) : groups.length === 0 ? (
        <Empty className="border rounded-xl">
          <EmptyHeader>
            <EmptyMedia variant="icon"><BellOff /></EmptyMedia>
            <EmptyTitle>No notifications</EmptyTitle>
            <EmptyDescription>
              {tab !== 'all'
                ? 'No notifications match this filter.'
                : "You're all caught up. We'll notify you when there's new activity."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-6">
          {groups.map(({ label, items }) => (
            <div key={label}>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 px-1">
                {label}
              </p>
              <div className="rounded-xl border overflow-hidden divide-y">
                {items.map((notif) => {
                  const t = tier(notif.type);
                  const isHovered = hoveredId === notif.id;
                  return (
                    <div
                      key={notif.id}
                      onMouseEnter={() => setHoveredId(notif.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      onClick={() => !notif.isRead && markRead(notif.id)}
                      className={cn(
                        'flex gap-4 px-4 py-3.5 transition-colors relative border-l-[3px] cursor-pointer group',
                        accentClass(t),
                        notif.isRead
                          ? 'bg-background hover:bg-muted/30 border-l-transparent'
                          : cn('hover:bg-muted/30', accentClass(t)),
                      )}
                    >
                      <NotifIcon type={notif.type} isRead={notif.isRead} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <p className={cn(
                            'text-sm leading-snug',
                            notif.isRead ? 'font-normal text-muted-foreground' : 'font-semibold text-foreground',
                          )}>
                            {notif.title}
                          </p>
                          <div className="flex items-center gap-2 shrink-0 mt-0.5">
                            {!notif.isRead && (
                              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                            )}
                            <span className="text-[0.7rem] text-muted-foreground whitespace-nowrap">
                              {format(new Date(notif.createdAt), isToday(new Date(notif.createdAt)) ? 'HH:mm' : 'MMM d, HH:mm')}
                            </span>
                          </div>
                        </div>

                        <p className="text-sm text-muted-foreground mt-0.5 leading-snug">
                          {notif.message}
                        </p>

                        <div className="flex items-center justify-between mt-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[0.65rem] capitalize h-5 px-1.5',
                              t === 'critical' && 'border-destructive/40 text-destructive bg-destructive/5',
                              t === 'info' && 'border-blue-500/40 text-blue-600 bg-blue-500/5',
                            )}
                          >
                            {notif.type.replace(/_/g, ' ').toLowerCase()}
                          </Badge>

                          {!notif.isRead && isHovered && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); markRead(notif.id); }}
                              className="flex items-center gap-1 text-[0.7rem] text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Check className="h-3 w-3" />
                              Mark read
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
