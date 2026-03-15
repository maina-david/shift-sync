'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Bell, BellOff, CheckCheck, AlertTriangle, Info, RefreshCw, Filter } from 'lucide-react';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useNotifications } from '@/contexts/notifications-context';
import { cn } from '@/lib/utils';

const CRITICAL_TYPES = ['SHIFT_UNCOVERED', 'UNCOVERED_SHIFT', 'SHIFT_CANCELLED', 'CERT_EXPIRY_WARNING'];
const INFO_TYPES = ['WEEKLY_SUMMARY', 'REPORT_READY'];

function tier(type: string): 'critical' | 'info' | 'standard' {
  const t = type?.toUpperCase() ?? '';
  if (CRITICAL_TYPES.some((k) => t.includes(k))) return 'critical';
  if (INFO_TYPES.some((k) => t.includes(k))) return 'info';
  return 'standard';
}

function NotifIcon({ type }: { type: string }) {
  const t = tier(type);
  if (t === 'critical') return <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />;
  if (t === 'info') return <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />;
  return <RefreshCw className="h-4 w-4 text-primary shrink-0 mt-0.5" />;
}

export default function NotificationsPage() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [typeFilter, setTypeFilter] = useState('all');

  // Derive unique top-level type categories for the filter
  const typeOptions = Array.from(
    new Set(notifications.map((n) => n.type?.replace(/_/g, ' ').toLowerCase()))
  ).sort();

  const filtered = typeFilter === 'all'
    ? notifications
    : notifications.filter((n) => n.type?.replace(/_/g, ' ').toLowerCase() === typeFilter);

  // Loading state — notifications come from context which initializes async
  const isLoading = false; // context loads instantly after mount

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground text-sm">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            <CheckCheck className="h-4 w-4 mr-2" />
            Mark all read
          </Button>
        )}
      </div>

      {/* Type filter */}
      {notifications.length > 0 && (
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-52 h-8 text-xs">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="__critical">Critical only</SelectItem>
              <SelectItem value="__unread">Unread only</SelectItem>
              <Separator className="my-1" />
              {typeOptions.map((t) => (
                <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {typeFilter !== 'all' && (
            <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={() => setTypeFilter('all')}>
              Clear
            </Button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon"><BellOff /></EmptyMedia>
            <EmptyTitle>No notifications</EmptyTitle>
            <EmptyDescription>
              {typeFilter !== 'all' ? 'No notifications match this filter.' : "You're all caught up. We'll notify you when there's new activity."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="rounded-xl border border-border/50 overflow-hidden divide-y divide-border/40">
          {filtered.map((notif) => {
            // handle virtual filters
            if (typeFilter === '__critical' && tier(notif.type) !== 'critical') return null;
            if (typeFilter === '__unread' && notif.isRead) return null;
            return (
              <div
                key={notif.id}
                className={cn(
                  'flex gap-3 p-4 cursor-pointer transition-colors',
                  notif.isRead ? 'hover:bg-muted/20' : 'bg-primary/5 hover:bg-primary/8',
                )}
                onClick={() => !notif.isRead && markRead(notif.id)}
              >
                <NotifIcon type={notif.type} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={cn('text-sm font-medium', !notif.isRead && 'text-foreground', notif.isRead && 'text-muted-foreground')}>
                      {notif.title}
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      {!notif.isRead && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(notif.createdAt), 'MMM d, HH:mm')}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{notif.message}</p>
                  <Badge variant="outline" className="text-xs mt-1.5 capitalize">
                    {notif.type.replace(/_/g, ' ').toLowerCase()}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
