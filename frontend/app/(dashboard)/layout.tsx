'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppSidebar, NAV_GROUPS } from '@/components/layout/app-sidebar';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/auth-context';
import { useNotifications } from '@/contexts/notifications-context';
import { bookmarksApi, notificationsApi, getErrorMessage } from '@/lib/api';
import { Bookmark } from '@/lib/types';
import { toast } from 'sonner';
import {
  Bell, BellOff, CheckCheck, Zap, LayoutPanelLeft,
  Bookmark as BookmarkIcon, BookmarkCheck, Trash2, ExternalLink,
  Sun, Moon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageTransition } from '@/components/ui/page-transition';
import { ErrorBoundary } from '@/components/ui/error-boundary';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/schedule': 'Schedule',
  '/my-schedule': 'My Schedule',
  '/staff': 'Staff',
  '/locations': 'Locations',
  '/skills': 'Skills',
  '/swap-requests': 'Swap & Drop',
  '/pickup': 'Open Shifts',
  '/time-off': 'Time Off',
  '/log-book': 'Log Book',
  '/analytics': 'Analytics',
  '/notifications': 'Notifications',
  '/audit': 'Audit Log',
  '/menu': 'Menu',
  '/reservations': 'Reservations',
  '/timesheets': 'Timesheets',
  '/schedule-templates': 'Schedule Templates',
  '/settings/system': 'System Settings',
  '/settings/availability': 'Availability',
  '/settings': 'Settings',
};

function getTitle(pathname: string): string {
  return (
    Object.entries(PAGE_TITLES)
      .sort((a, b) => b[0].length - a[0].length)
      .find(([path]) => pathname === path || pathname.startsWith(path + '/'))?.[1] ?? 'ShiftSync'
  );
}

function getActiveGroupId(pathname: string, role: string): string {
  const visible = NAV_GROUPS.filter(
    (g) => g.roles.includes(role) && g.items.some((i) => i.roles.includes(role)),
  );
  for (let i = visible.length - 1; i >= 0; i--) {
    const g = visible[i];
    if (
      g.items.some(
        (item) =>
          pathname === item.href ||
          (item.href !== '/settings' && pathname.startsWith(item.href + '/')),
      )
    ) {
      return g.id;
    }
  }
  return visible[0]?.id ?? 'main';
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  const [notifOpen, setNotifOpen] = useState(false);
  const [bookmarkOpen, setBookmarkOpen] = useState(false);

  const [secondaryOpen, setSecondaryOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar-secondary') !== 'false';
    }
    return true;
  });

  const [selectedGroupId, setSelectedGroupId] = useState<string>('main');

  useEffect(() => {
    if (user) {
      setSelectedGroupId(getActiveGroupId(pathname, user.role));
    }
  }, [pathname, user]);

  const toggleSecondary = () => {
    setSecondaryOpen((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar-secondary', String(next));
      return next;
    });
  };

  const handleSelectGroup = (id: string) => {
    if (id === selectedGroupId && secondaryOpen) {
      setSecondaryOpen(false);
      localStorage.setItem('sidebar-secondary', 'false');
    } else {
      setSelectedGroupId(id);
      if (!secondaryOpen) {
        setSecondaryOpen(true);
        localStorage.setItem('sidebar-secondary', 'true');
      }
    }
  };

  const { data: bookmarks = [] } = useQuery<Bookmark[]>({
    queryKey: ['bookmarks'],
    queryFn: bookmarksApi.list,
    enabled: !!user,
  });

  const title = getTitle(pathname);
  const currentBookmark = bookmarks.find((b) => b.href === pathname);
  const isBookmarked = !!currentBookmark;

  const toggleBookmarkMutation = useMutation({
    mutationFn: () =>
      isBookmarked
        ? bookmarksApi.remove(currentBookmark!.id)
        : bookmarksApi.create({ label: title, href: pathname }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
      toast.success(isBookmarked ? 'Bookmark removed' : 'Bookmark saved');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const removeBookmarkMutation = useMutation({
    mutationFn: (id: string) => bookmarksApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bookmarks'] }),
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 rounded-xl blur-lg animate-pulse" />
            <div className="relative w-11 h-11 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center">
              <Zap className="h-5 w-5 text-primary" />
            </div>
          </div>
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-primary/40 animate-bounce"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const recentNotifs = notifications.slice(0, 6);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <AppSidebar
        selectedGroupId={selectedGroupId}
        onSelectGroup={handleSelectGroup}
        secondaryOpen={secondaryOpen}
      />

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-3 border-b border-border/50 bg-background/80 backdrop-blur-md px-4">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground transition-colors duration-150"
            onClick={toggleSecondary}
          >
            <LayoutPanelLeft className="h-4 w-4" />
          </Button>

          <div className="h-3.5 w-px bg-border/60" />
          <span className="text-sm font-medium">{title}</span>

          <div className="flex-1" />

          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {/* Live indicator */}
          <div className="flex items-center gap-1.5 rounded-md border border-chart-success/20 bg-chart-success/8 px-2 py-1">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-chart-success opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-chart-success" />
            </span>
            <span className="text-xs font-medium text-chart-success">Live</span>
          </div>

          {/* Bookmarks */}
          <Popover open={bookmarkOpen} onOpenChange={setBookmarkOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'relative h-8 w-8 transition-colors',
                  isBookmarked
                    ? 'text-primary hover:text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {isBookmarked ? (
                  <BookmarkCheck className="h-4 w-4 fill-primary/20" />
                ) : (
                  <BookmarkIcon className="h-4 w-4" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" sideOffset={8} className="w-72 p-0 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                <p className="text-sm font-semibold">Bookmarks</p>
                <Button
                  size="sm"
                  variant={isBookmarked ? 'outline' : 'default'}
                  className="h-7 text-xs"
                  onClick={() => toggleBookmarkMutation.mutate()}
                  disabled={toggleBookmarkMutation.isPending}
                >
                  {isBookmarked ? 'Remove current' : 'Bookmark this page'}
                </Button>
              </div>

              <div className="max-h-72 overflow-y-auto">
                {bookmarks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
                    <BookmarkIcon className="h-7 w-7 opacity-25" />
                    <p className="text-sm">No bookmarks yet</p>
                    <p className="text-xs opacity-70">Bookmark this page to save it here</p>
                  </div>
                ) : (
                  bookmarks.map((bm, i) => (
                    <div key={bm.id}>
                      <div className="flex items-center gap-2 px-4 py-2.5 hover:bg-muted/30 transition-colors group">
                        <Link
                          href={bm.href}
                          onClick={() => setBookmarkOpen(false)}
                          className="flex-1 min-w-0 flex items-center gap-2"
                        >
                          <BookmarkIcon className="h-3.5 w-3.5 shrink-0 text-primary/70" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{bm.label}</p>
                            <p className="text-xs text-muted-foreground truncate">{bm.href}</p>
                          </div>
                          <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                          onClick={() => removeBookmarkMutation.mutate(bm.id)}
                          disabled={removeBookmarkMutation.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      {i < bookmarks.length - 1 && <Separator />}
                    </div>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Notifications */}
          <Popover open={notifOpen} onOpenChange={setNotifOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[0.5625rem] font-bold text-primary-foreground">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" sideOffset={8} className="w-80 p-0 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">Notifications</p>
                  {unreadCount > 0 && (
                    <span className="inline-flex items-center rounded-full bg-primary/15 text-primary border border-primary/20 px-1.5 py-0 text-[0.625rem] font-semibold">
                      {unreadCount}
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                    onClick={() => markAllRead()}
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    Mark all read
                  </Button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto">
                {recentNotifs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
                    <BellOff className="h-8 w-8 opacity-30" />
                    <p className="text-sm">No notifications yet</p>
                  </div>
                ) : (
                  recentNotifs.map((notif, i) => (
                    <div key={notif.id}>
                      <div
                        className={cn(
                          'flex gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-muted/30',
                          !notif.isRead && 'bg-primary/5',
                        )}
                        onClick={() => { if (!notif.isRead) markRead(notif.id); }}
                      >
                        <div className="shrink-0 mt-1.5">
                          {!notif.isRead ? (
                            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                          ) : (
                            <div className="w-1.5 h-1.5" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={cn('text-xs font-medium leading-snug', !notif.isRead ? 'text-foreground' : 'text-muted-foreground')}>
                              {notif.title}
                            </p>
                            <span className="text-[0.625rem] text-muted-foreground shrink-0 mt-0.5">
                              {format(new Date(notif.createdAt), 'HH:mm')}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-2">
                            {notif.message}
                          </p>
                        </div>
                      </div>
                      {i < recentNotifs.length - 1 && <Separator />}
                    </div>
                  ))
                )}
              </div>

              <div className="border-t border-border/50 p-2">
                <Link
                  href="/notifications"
                  onClick={() => setNotifOpen(false)}
                  className="flex w-full items-center justify-center rounded-md px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                >
                  View all notifications
                </Link>
              </div>
            </PopoverContent>
          </Popover>
        </header>

        <main className="flex-1 overflow-auto p-6">
          <ErrorBoundary>
            <PageTransition motionKey={pathname}>{children}</PageTransition>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
