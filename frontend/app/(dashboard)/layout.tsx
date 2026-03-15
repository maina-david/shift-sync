'use client';

import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppSidebar, NAV_GROUPS } from '@/components/layout/app-sidebar';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from '@/components/ui/command';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/auth-context';
import { useNotifications } from '@/contexts/notifications-context';
import { useMessages } from '@/contexts/messages-context';
import { bookmarksApi, getErrorMessage } from '@/lib/api';
import { Bookmark } from '@/lib/types';
import { toast } from 'sonner';
import {
  Bell, BellOff, CheckCheck, Zap, LayoutPanelLeft,
  Bookmark as BookmarkIcon, BookmarkCheck, Trash2, ExternalLink,
  Sun, Moon, LayoutDashboard, CalendarDays, CalendarRange,
  ArrowLeftRight, HandHelping, Users, MessageSquare,
  AlertTriangle, Info, Send, PenSquare, ArrowLeft, Loader2,
} from 'lucide-react';
import { isToday, isYesterday } from 'date-fns';
import { cn } from '@/lib/utils';
import { PageTransition } from '@/components/ui/page-transition';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { NetworkStatusBanner } from '@/components/ui/network-status-banner';

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

function MessagesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const {
    partners, staffList, isLoading,
    selectedUserId, selectedUser, selectUser, clearSelection,
    thread, threadLoading, send, isSending, markRead,
  } = useMessages();

  const [replyBody, setReplyBody] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeRecipient, setComposeRecipient] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [recipientOpen, setRecipientOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread]);

  useEffect(() => {
    if (!selectedUserId || !user) return;
    thread
      .filter((m) => !m.isRead && m.recipientId === user.id)
      .forEach((m) => markRead(m.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread, selectedUserId]);

  const handleSendReply = () => {
    if (!replyBody.trim() || !selectedUserId) return;
    send({ type: 'direct', recipientId: selectedUserId, body: replyBody.trim() });
    setReplyBody('');
  };

  const handleCompose = () => {
    if (!composeBody.trim() || !composeRecipient) return;
    send({ type: 'direct', recipientId: composeRecipient, body: composeBody.trim() });
    setComposeBody('');
    setComposeRecipient('');
    setComposeOpen(false);
    selectUser(composeRecipient);
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) { onClose(); clearSelection(); } }}>
      <SheetContent side="right" showCloseButton={false} className="w-100 sm:w-110 p-0 flex flex-col gap-0">
        <SheetTitle className="sr-only">Messages</SheetTitle>
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          {selectedUserId && selectedUser ? (
            <div className="flex items-center gap-2 min-w-0">
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={clearSelection}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[0.65rem] font-semibold shrink-0">
                {selectedUser.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{selectedUser.name}</p>
                <p className="text-[0.65rem] text-muted-foreground capitalize">{selectedUser.role}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm font-semibold">Messages</p>
          )}
          <div className="flex items-center gap-1 shrink-0 ml-2">
            {!selectedUserId && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => setComposeOpen(true)}>
                <PenSquare className="h-3.5 w-3.5" />
              </Button>
            )}
            <Link
              href="/messages"
              onClick={onClose}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted/50 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              Full view
            </Link>
          </div>
        </div>

        {composeOpen && (
          <div className="absolute inset-0 z-10 bg-background flex flex-col">
            <div className="flex items-center gap-2 px-4 py-3 border-b">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setComposeOpen(false)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <p className="text-sm font-semibold">New Message</p>
            </div>
            <div className="flex-1 flex flex-col gap-4 p-4">
              <div className="grid gap-1.5">
                <Label className="text-xs">To</Label>
                <Popover open={recipientOpen} onOpenChange={setRecipientOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between font-normal h-9 text-sm"
                    >
                      <span className={composeRecipient ? '' : 'text-muted-foreground'}>
                        {composeRecipient
                          ? staffList.find((s) => s.id === composeRecipient)?.name
                          : 'Select a team member…'}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search…" />
                      <CommandList>
                        <CommandEmpty>No team members found</CommandEmpty>
                        <CommandGroup>
                          {staffList
                            .filter((s) => s.id !== user?.id)
                            .map((s) => (
                              <CommandItem
                                key={s.id}
                                value={s.name}
                                onSelect={() => {
                                  setComposeRecipient(s.id);
                                  setRecipientOpen(false);
                                }}
                              >
                                {s.name}
                              </CommandItem>
                            ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid gap-1.5 flex-1">
                <Label className="text-xs">Message</Label>
                <Textarea
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  placeholder="Write your message…"
                  className="flex-1 min-h-32 resize-none text-sm"
                />
              </div>
            </div>
            <div className="border-t px-4 py-3 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setComposeOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={handleCompose} disabled={!composeBody.trim() || !composeRecipient || isSending}>
                <Send className="h-3.5 w-3.5 mr-1.5" />
                {isSending ? 'Sending…' : 'Send'}
              </Button>
            </div>
          </div>
        )}

        {selectedUserId ? (
          <>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              {threadLoading ? (
                <div className="flex flex-col gap-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-3/4 rounded-2xl" />)}
                </div>
              ) : thread.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">No messages yet — say hello!</p>
              ) : (
                thread.map((m) => {
                  const isMine = m.senderId === user?.id;
                  return (
                    <div key={m.id} className={cn('flex', isMine ? 'justify-end' : 'justify-start')}>
                      <div className={cn(
                        'max-w-[78%] rounded-2xl px-3.5 py-2 text-sm',
                        isMine
                          ? 'bg-primary text-primary-foreground rounded-br-sm'
                          : 'bg-muted text-foreground rounded-bl-sm',
                      )}>
                        <p className="leading-relaxed whitespace-pre-wrap">{m.body}</p>
                        <p className={cn(
                          'text-[0.6rem] mt-0.5',
                          isMine ? 'text-primary-foreground/60 text-right' : 'text-muted-foreground',
                        )}>
                          {format(new Date(m.createdAt), 'HH:mm')}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            <div className="border-t px-3 py-3 shrink-0">
              <div className="flex gap-2 items-end">
                <Textarea
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder={`Message ${selectedUser?.name ?? ''}…`}
                  className="min-h-9 max-h-28 resize-none text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendReply();
                    }
                  }}
                />
                <Button
                  size="icon"
                  className="shrink-0 h-9 w-9"
                  onClick={handleSendReply}
                  disabled={!replyBody.trim() || isSending}
                >
                  {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-[0.6rem] text-muted-foreground mt-1">Enter to send · Shift+Enter for new line</p>
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex flex-col gap-1 p-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
              </div>
            ) : partners.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-6">
                <MessageSquare className="h-10 w-10 text-muted-foreground/25" />
                <p className="text-sm font-medium text-muted-foreground">No conversations yet</p>
                <Button size="sm" variant="outline" onClick={() => setComposeOpen(true)}>
                  <PenSquare className="h-3.5 w-3.5 mr-1.5" />
                  Start a conversation
                </Button>
              </div>
            ) : (
              <div className="flex flex-col divide-y">
                {partners.map((partner) => (
                  <button
                    key={partner.id}
                    type="button"
                    onClick={() => selectUser(partner.id)}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left w-full"
                  >
                    <div className={cn(
                      'w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0',
                      partner.unread ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                    )}>
                      {partner.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={cn(
                          'text-sm truncate',
                          partner.unread ? 'font-semibold text-foreground' : 'font-medium text-foreground',
                        )}>
                          {partner.name}
                        </p>
                        <span className="text-[0.65rem] text-muted-foreground shrink-0">
                          {format(new Date(partner.latest.createdAt), isToday(new Date(partner.latest.createdAt)) ? 'HH:mm' : 'MMM d')}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{partner.latest.body}</p>
                    </div>
                    {partner.unread && <div className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const { unreadCount: msgUnread } = useMessages();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  const [notifOpen, setNotifOpen] = useState(false);
  const [bookmarkOpen, setBookmarkOpen] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);

  const [secondaryOpen, setSecondaryOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar-secondary') !== 'false';
    }
    return true;
  });

  const [selectedGroupId, setSelectedGroupId] = useState<string>('main');

  useEffect(() => {
    if (user) setSelectedGroupId(getActiveGroupId(pathname, user.role));
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

  const recentNotifs = notifications.slice(0, 12);

  function notifIcon(type: string) {
    const t = type?.toUpperCase() ?? '';
    if (['SHIFT_UNCOVERED', 'UNCOVERED_SHIFT', 'SHIFT_CANCELLED', 'CERT_EXPIRY_WARNING'].some((k) => t.includes(k)))
      return <AlertTriangle className="h-3 w-3 text-destructive" />;
    if (['WEEKLY_SUMMARY', 'REPORT_READY'].some((k) => t.includes(k)))
      return <Info className="h-3 w-3 text-muted-foreground" />;
    return <Bell className="h-3 w-3 text-primary" />;
  }

  function groupLabel(dateStr: string) {
    const d = new Date(dateStr);
    if (isToday(d)) return 'Today';
    if (isYesterday(d)) return 'Yesterday';
    return format(d, 'MMM d');
  }

  const groupedNotifs = recentNotifs.reduce<Record<string, typeof recentNotifs>>((acc, n) => {
    const key = groupLabel(n.createdAt);
    (acc[key] = acc[key] ?? []).push(n);
    return acc;
  }, {});

  const mobileNavItems = user?.role === 'staff'
    ? [
        { href: '/dashboard', icon: LayoutDashboard, label: 'Home', badge: 0 },
        { href: '/my-schedule', icon: CalendarRange, label: 'Schedule', badge: 0 },
        { href: '/pickup', icon: HandHelping, label: 'Open Shifts', badge: 0 },
        { href: '/swap-requests', icon: ArrowLeftRight, label: 'Requests', badge: 0 },
        { href: '/messages', icon: MessageSquare, label: 'Messages', badge: msgUnread },
      ]
    : [
        { href: '/dashboard', icon: LayoutDashboard, label: 'Home', badge: 0 },
        { href: '/schedule', icon: CalendarDays, label: 'Schedule', badge: 0 },
        { href: '/staff', icon: Users, label: 'Staff', badge: 0 },
        { href: '/swap-requests', icon: ArrowLeftRight, label: 'Requests', badge: 0 },
        { href: '/messages', icon: MessageSquare, label: 'Messages', badge: msgUnread },
      ];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden md:flex h-full">
        <AppSidebar
          selectedGroupId={selectedGroupId}
          onSelectGroup={handleSelectGroup}
          secondaryOpen={secondaryOpen}
        />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
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

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          <div className="flex items-center gap-1.5 rounded-md border border-chart-success/20 bg-chart-success/8 px-2 py-1">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-chart-success opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-chart-success" />
            </span>
            <span className="text-xs font-medium text-chart-success">Online</span>
          </div>

          <Popover open={bookmarkOpen} onOpenChange={setBookmarkOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'relative h-8 w-8 transition-colors',
                  isBookmarked ? 'text-primary hover:text-primary' : 'text-muted-foreground hover:text-foreground',
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

          <Button
            variant="ghost"
            size="icon"
            className="relative h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => setMessagesOpen(true)}
          >
            <MessageSquare className="h-4 w-4" />
            {msgUnread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[0.5625rem] font-bold text-primary-foreground">
                {msgUnread > 9 ? '9+' : msgUnread}
              </span>
            )}
          </Button>

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
              <div className="max-h-96 overflow-y-auto">
                {recentNotifs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
                    <BellOff className="h-8 w-8 opacity-30" />
                    <p className="text-sm">No notifications yet</p>
                  </div>
                ) : (
                  Object.entries(groupedNotifs).map(([group, items]) => (
                    <div key={group}>
                      <p className="px-4 py-1.5 text-[0.625rem] font-semibold uppercase tracking-widest text-muted-foreground/60 bg-muted/20 sticky top-0">
                        {group}
                      </p>
                      {items.map((notif, i) => (
                        <div key={notif.id}>
                          <div
                            className={cn(
                              'flex gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-muted/30',
                              !notif.isRead && 'bg-primary/5',
                            )}
                            onClick={() => { if (!notif.isRead) markRead(notif.id); }}
                          >
                            <div className="shrink-0 mt-1 flex flex-col items-center gap-1">
                              {notifIcon(notif.type)}
                              {!notif.isRead && <div className="w-1 h-1 rounded-full bg-primary" />}
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
                          {i < items.length - 1 && <Separator />}
                        </div>
                      ))}
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

        <NetworkStatusBanner />

        <main className="flex-1 overflow-auto p-4 md:p-6 pb-20 md:pb-6">
          <ErrorBoundary>
            <PageTransition motionKey={pathname}>{children}</PageTransition>
          </ErrorBoundary>
        </main>
      </div>

      <MessagesSheet open={messagesOpen} onClose={() => setMessagesOpen(false)} />

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-md">
        <div className="flex items-center justify-around px-1 py-1.5">
          {mobileNavItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors min-w-13',
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <item.icon className={cn('h-5 w-5', isActive && 'fill-primary/10')} />
                <span className="text-[0.6rem] font-medium leading-tight">{item.label}</span>
                {item.badge > 0 && (
                  <span className="absolute top-0.5 right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[0.5rem] font-bold text-primary-foreground">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
