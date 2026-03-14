'use client';

import { format } from 'date-fns';
import { Bell, BellOff, CheckCheck } from 'lucide-react';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useNotifications } from '@/contexts/notifications-context';
import { cn } from '@/lib/utils';

export default function NotificationsPage() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();

  return (
    <div className="space-y-4">
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

      {notifications.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon"><BellOff /></EmptyMedia>
            <EmptyTitle>No notifications yet</EmptyTitle>
            <EmptyDescription>You're all caught up. We'll notify you when there's new activity.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-1">
          {notifications.map((notif, i) => (
            <div key={notif.id}>
              <div
                className={cn(
                  'flex gap-3 p-4 rounded-lg cursor-pointer transition-colors',
                  notif.isRead ? 'opacity-70 hover:bg-muted/30' : 'bg-primary/5 hover:bg-primary/10',
                )}
                onClick={() => !notif.isRead && markRead(notif.id)}
              >
                <div className="shrink-0 mt-0.5">
                  {!notif.isRead ? (
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                  ) : (
                    <div className="w-2 h-2" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={cn('text-sm font-medium', !notif.isRead && 'text-foreground')}>
                      {notif.title}
                    </p>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {format(new Date(notif.createdAt), 'MMM d, HH:mm')}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{notif.message}</p>
                  <Badge variant="outline" className="text-xs mt-1 capitalize">
                    {notif.type.replace(/_/g, ' ').toLowerCase()}
                  </Badge>
                </div>
              </div>
              {i < notifications.length - 1 && <Separator />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
