'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  MessageSquare,
  Megaphone,
  Send,
  PenSquare,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { messagesApi, usersApi, getErrorMessage } from '@/lib/api';
import { Message, User } from '@/lib/types';
import { useAuth } from '@/contexts/auth-context';
import { cn } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeLabel(iso: string) {
  return format(new Date(iso), 'MMM d, HH:mm');
}

/** Deduplicate inbox partners: for a given DM, the "other" user is the one who
 *  is not the currently logged-in user. */
function dmPartners(messages: Message[], myId: string): { user: User; latest: Message }[] {
  const map = new Map<string, { user: User; latest: Message }>();
  for (const m of messages) {
    if (m.type !== 'direct') continue;
    const other = m.senderId === myId ? m.recipient : m.sender;
    if (!other) continue;
    const existing = map.get(other.id);
    if (!existing || new Date(m.createdAt) > new Date(existing.latest.createdAt)) {
      map.set(other.id, { user: other, latest: m });
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.latest.createdAt).getTime() - new Date(a.latest.createdAt).getTime(),
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Selection =
  | { kind: 'announcement'; message: Message }
  | { kind: 'dm'; userId: string; user: User };

export default function MessagesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selection, setSelection] = useState<Selection | null>(null);
  const [expandedAnnouncements, setExpandedAnnouncements] = useState<Set<string>>(new Set());
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeRecipient, setComposeRecipient] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [replyBody, setReplyBody] = useState('');

  const bottomRef = useRef<HTMLDivElement>(null);

  // ── Queries ──

  const { data: inbox = [], isLoading: inboxLoading } = useQuery<Message[]>({
    queryKey: ['messages-inbox'],
    queryFn: messagesApi.getInbox,
    refetchInterval: 30_000,
  });

  const { data: announcements = [], isLoading: annLoading } = useQuery<Message[]>({
    queryKey: ['announcements'],
    queryFn: () => messagesApi.getAnnouncements(),
    refetchInterval: 30_000,
  });

  const selectedUserId = selection?.kind === 'dm' ? selection.userId : undefined;

  const { data: thread = [] } = useQuery<Message[]>({
    queryKey: ['thread', selectedUserId],
    queryFn: () => messagesApi.getThread(selectedUserId!),
    enabled: !!selectedUserId,
    refetchInterval: 30_000,
  });

  const { data: staffList = [] } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
  });

  // ── Mutations ──

  const sendMutation = useMutation({
    mutationFn: (data: Parameters<typeof messagesApi.send>[0]) => messagesApi.send(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages-inbox'] });
      if (selectedUserId) {
        queryClient.invalidateQueries({ queryKey: ['thread', selectedUserId] });
      }
      setReplyBody('');
      setComposeBody('');
      setComposeRecipient('');
      setComposeOpen(false);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => messagesApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages-inbox'] });
      queryClient.invalidateQueries({ queryKey: ['thread', selectedUserId] });
    },
  });

  // Auto-scroll to bottom when thread changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread]);

  // Mark unread messages in open thread as read
  useEffect(() => {
    if (!selectedUserId || !user) return;
    thread
      .filter((m) => !m.isRead && m.recipientId === user.id)
      .forEach((m) => markReadMutation.mutate(m.id));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread, selectedUserId]);

  const toggleAnnouncementExpand = (id: string) => {
    setExpandedAnnouncements((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const partners = dmPartners(inbox, user?.id ?? '');
  const recentAnnouncements = announcements.slice(0, 5);

  const handleSendReply = () => {
    if (!replyBody.trim() || !selectedUserId) return;
    sendMutation.mutate({ type: 'direct', recipientId: selectedUserId, body: replyBody.trim() });
  };

  const handleCompose = () => {
    if (!composeBody.trim() || !composeRecipient) return;
    sendMutation.mutate({ type: 'direct', recipientId: composeRecipient, body: composeBody.trim() });
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0 -mx-6 -mt-6 overflow-hidden">
      {/* ── Sidebar ── */}
      <aside className="w-64 shrink-0 flex flex-col border-r overflow-y-auto">
        {/* New Message button */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h1 className="text-base font-semibold">Messages</h1>
          <Button size="sm" variant="outline" onClick={() => setComposeOpen(true)}>
            <PenSquare className="h-3.5 w-3.5 mr-1.5" />
            New
          </Button>
        </div>

        {/* Announcements section */}
        <div className="px-3 pt-3 pb-1">
          <p className="text-[0.625rem] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 px-1">
            Announcements
          </p>
          {annLoading ? (
            <div className="flex flex-col gap-1 px-1 py-1">
              {[1, 2].map((i) => <Skeleton key={i} className="h-10 w-full rounded-md" />)}
            </div>
          ) : recentAnnouncements.length === 0 ? (
            <p className="text-xs text-muted-foreground px-1 py-2">No announcements</p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {recentAnnouncements.map((a) => {
                const isExpanded = expandedAnnouncements.has(a.id);
                const isSelected = selection?.kind === 'announcement' && selection.message.id === a.id;
                return (
                  <div key={a.id}>
                    <button
                      onClick={() => {
                        setSelection({ kind: 'announcement', message: a });
                        if (!a.isRead) markReadMutation.mutate(a.id);
                      }}
                      className={cn(
                        'w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors',
                        isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50',
                        !a.isRead && 'font-medium',
                      )}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="truncate flex-1">{a.body.slice(0, 40)}{a.body.length > 40 ? '…' : ''}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleAnnouncementExpand(a.id); }}
                          className="shrink-0 text-muted-foreground hover:text-foreground"
                        >
                          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>
                      </div>
                      <p className="text-muted-foreground text-[0.6rem] mt-0.5">{a.sender.name} · {timeLabel(a.createdAt)}</p>
                      {isExpanded && (
                        <p className="mt-1 text-xs text-foreground whitespace-pre-wrap">{a.body}</p>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <Separator className="my-2" />

        {/* Direct Messages section */}
        <div className="px-3 pb-3 flex-1">
          <p className="text-[0.625rem] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 px-1">
            Direct Messages
          </p>
          {inboxLoading ? (
            <div className="flex flex-col gap-1 px-1 py-1">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-md" />)}
            </div>
          ) : partners.length === 0 ? (
            <div className="px-1 py-3 flex flex-col items-center gap-2 text-center">
              <MessageSquare className="h-6 w-6 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">No conversations yet</p>
              <Button size="sm" variant="outline" className="h-7 text-xs w-full" onClick={() => setComposeOpen(true)}>
                <PenSquare className="h-3 w-3 mr-1.5" /> Start a conversation
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              {partners.map(({ user: partner, latest }) => {
                const isSelected = selection?.kind === 'dm' && selection.userId === partner.id;
                const isUnread = !latest.isRead && latest.recipientId === user?.id;
                return (
                  <button
                    key={partner.id}
                    onClick={() => setSelection({ kind: 'dm', userId: partner.id, user: partner })}
                    className={cn(
                      'w-full text-left px-2 py-2 rounded-md transition-colors',
                      isSelected ? 'bg-primary/10' : 'hover:bg-muted/50',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center text-[0.6rem] font-semibold shrink-0',
                        isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                      )}>
                        {partner.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-xs truncate', isUnread ? 'font-semibold' : 'font-medium')}>
                          {partner.name}
                        </p>
                        <p className="text-[0.6rem] text-muted-foreground truncate">{latest.body}</p>
                      </div>
                      {isUnread && <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      {/* ── Main area ── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {!selection ? (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <MessageSquare className="h-12 w-12 opacity-20" />
            <p className="text-sm font-medium">Select a conversation</p>
            <p className="text-xs">Choose a message thread from the sidebar</p>
          </div>
        ) : selection.kind === 'announcement' ? (
          /* Announcement detail */
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto">
              <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 p-6">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-9 h-9 rounded-full bg-indigo-200 dark:bg-indigo-800 flex items-center justify-center shrink-0">
                    <Megaphone className="h-4 w-4 text-indigo-700 dark:text-indigo-300" />
                  </div>
                  <div>
                    <p className="font-semibold text-indigo-900 dark:text-indigo-100 text-sm">
                      {selection.message.sender.name}
                    </p>
                    <p className="text-xs text-indigo-600 dark:text-indigo-400">
                      {timeLabel(selection.message.createdAt)}
                    </p>
                  </div>
                  <Badge className="ml-auto bg-indigo-600 hover:bg-indigo-700 text-white text-xs">
                    Announcement
                  </Badge>
                </div>
                <p className="text-sm text-indigo-900 dark:text-indigo-100 whitespace-pre-wrap leading-relaxed">
                  {selection.message.body}
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* DM thread */
          <>
            {/* Thread header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                {selection.user.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold">{selection.user.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{selection.user.role}</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              {thread.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">
                  No messages yet. Say hello!
                </p>
              )}
              {thread.map((m) => {
                const isMine = m.senderId === user?.id;
                return (
                  <div key={m.id} className={cn('flex', isMine ? 'justify-end' : 'justify-start')}>
                    <div
                      className={cn(
                        'max-w-[70%] rounded-2xl px-4 py-2.5 text-sm',
                        isMine
                          ? 'bg-primary text-primary-foreground rounded-br-sm'
                          : 'bg-muted text-foreground rounded-bl-sm',
                      )}
                    >
                      <p className="leading-relaxed whitespace-pre-wrap">{m.body}</p>
                      <p className={cn(
                        'text-[0.6rem] mt-1',
                        isMine ? 'text-primary-foreground/60 text-right' : 'text-muted-foreground',
                      )}>
                        {timeLabel(m.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Reply input */}
            <div className="border-t px-4 py-3 shrink-0">
              <div className="flex gap-2 items-end">
                <Textarea
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder={`Message ${selection.user.name}…`}
                  className="min-h-[2.5rem] max-h-32 resize-none text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendReply();
                    }
                  }}
                />
                <Button
                  size="icon"
                  onClick={handleSendReply}
                  disabled={!replyBody.trim() || sendMutation.isPending}
                  className="shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-[0.6rem] text-muted-foreground mt-1">Enter to send · Shift+Enter for new line</p>
            </div>
          </>
        )}
      </main>

      {/* ── Compose Dialog ── */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Message</DialogTitle>
            <DialogDescription>Send a direct message to a team member.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Recipient</Label>
              <Select value={composeRecipient} onValueChange={setComposeRecipient}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a team member…" />
                </SelectTrigger>
                <SelectContent>
                  {staffList
                    .filter((s) => s.id !== user?.id)
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Message</Label>
              <Textarea
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                placeholder="Write your message…"
                className="min-h-[100px] resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setComposeOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCompose}
              disabled={!composeBody.trim() || !composeRecipient || sendMutation.isPending}
            >
              <Send className="h-4 w-4 mr-2" />
              {sendMutation.isPending ? 'Sending…' : 'Send'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
