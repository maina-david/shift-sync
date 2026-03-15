'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { messagesApi, usersApi } from '@/lib/api';
import { Message } from '@/lib/types';
import { useAuth } from './auth-context';
import { toast } from 'sonner';

export interface DmPartner {
  id: string;
  name: string;
  role: string;
  latest: Message;
  unread: boolean;
}

interface MessagesContextValue {
  inbox: Message[];
  announcements: Message[];
  partners: DmPartner[];
  unreadCount: number;
  staffList: { id: string; name: string; role: string }[];
  // active thread
  selectedUserId: string | null;
  selectedUser: { id: string; name: string; role: string } | null;
  selectUser: (id: string) => void;
  clearSelection: () => void;
  // thread messages
  thread: Message[];
  threadLoading: boolean;
  // actions
  send: (data: Parameters<typeof messagesApi.send>[0]) => void;
  isSending: boolean;
  markRead: (id: string) => void;
  isLoading: boolean;
}

const MessagesContext = createContext<MessagesContextValue | null>(null);

export function MessagesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // ── Inbox ──────────────────────────────────────────────────────────────────

  const { data: inboxData, isLoading: inboxLoading } = useQuery<{
    threads: Message[];
    announcements: Message[];
  }>({
    queryKey: ['messages-inbox'],
    queryFn: () => messagesApi.getInbox() as any,
    // getInbox is typed as Promise<Message[]> but actually returns {threads,announcements}
    // We cast here and use the raw response.
    select: (raw: any) => ({
      threads: raw?.threads ?? (Array.isArray(raw) ? raw : []),
      announcements: raw?.announcements ?? [],
    }),
    refetchInterval: 30_000,
    enabled: !!user,
  });

  const inbox = inboxData?.threads ?? [];
  const announcements = inboxData?.announcements ?? [];

  // ── Staff directory ────────────────────────────────────────────────────────

  const { data: staffList = [] } = useQuery<{ id: string; name: string; role: string }[]>({
    queryKey: ['users-directory'],
    queryFn: usersApi.directory,
    staleTime: 5 * 60_000,
    enabled: !!user,
  });

  // ── Partners ───────────────────────────────────────────────────────────────

  const partners = useMemo<DmPartner[]>(() => {
    if (!user) return [];
    const map = new Map<string, DmPartner>();
    for (const m of inbox) {
      if (m.type !== 'direct') continue;
      const other = m.senderId === user.id ? m.recipient : m.sender;
      if (!other) continue;
      const existing = map.get(other.id);
      if (!existing || new Date(m.createdAt) > new Date(existing.latest.createdAt)) {
        map.set(other.id, {
          id: other.id,
          name: other.name ?? (staffList.find((s) => s.id === other.id)?.name ?? 'Unknown'),
          role: (other as any).role ?? (staffList.find((s) => s.id === other.id)?.role ?? ''),
          latest: m,
          unread: !m.isRead && m.recipientId === user.id,
        });
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.latest.createdAt).getTime() - new Date(a.latest.createdAt).getTime(),
    );
  }, [inbox, user, staffList]);

  const unreadCount = partners.filter((p) => p.unread).length;

  // ── Active thread ──────────────────────────────────────────────────────────

  const { data: thread = [], isLoading: threadLoading } = useQuery<Message[]>({
    queryKey: ['thread', selectedUserId],
    queryFn: () => messagesApi.getThread(selectedUserId!),
    enabled: !!selectedUserId,
    refetchInterval: 15_000,
  });

  const selectedUser = useMemo(() => {
    if (!selectedUserId) return null;
    return staffList.find((s) => s.id === selectedUserId)
      ?? partners.find((p) => p.id === selectedUserId)
      ?? null;
  }, [selectedUserId, staffList, partners]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const sendMutation = useMutation({
    mutationFn: messagesApi.send,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages-inbox'] });
      if (selectedUserId) {
        queryClient.invalidateQueries({ queryKey: ['thread', selectedUserId] });
      }
    },
    onError: () => toast.error('Failed to send message'),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => messagesApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages-inbox'] });
      if (selectedUserId) {
        queryClient.invalidateQueries({ queryKey: ['thread', selectedUserId] });
      }
    },
  });

  // ── Actions ────────────────────────────────────────────────────────────────

  const selectUser = useCallback((id: string) => setSelectedUserId(id), []);
  const clearSelection = useCallback(() => setSelectedUserId(null), []);

  return (
    <MessagesContext.Provider
      value={{
        inbox,
        announcements,
        partners,
        unreadCount,
        staffList,
        selectedUserId,
        selectedUser,
        selectUser,
        clearSelection,
        thread,
        threadLoading,
        send: sendMutation.mutate,
        isSending: sendMutation.isPending,
        markRead: markReadMutation.mutate,
        isLoading: inboxLoading,
      }}
    >
      {children}
    </MessagesContext.Provider>
  );
}

export function useMessages() {
  const ctx = useContext(MessagesContext);
  if (!ctx) throw new Error('useMessages must be used within MessagesProvider');
  return ctx;
}
