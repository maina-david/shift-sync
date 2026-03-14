'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Notification } from '@/lib/types';
import { notificationsApi } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuth } from './auth-context';
import { toast } from 'sonner';

interface NotificationsContextValue {
  notifications: Notification[];
  unreadCount: number;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  refresh: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) return;
    const [notifs, { count }] = await Promise.all([
      notificationsApi.list(),
      notificationsApi.unreadCount(),
    ]);
    setNotifications(notifs);
    setUnreadCount(count);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    refresh();

    const socket = getSocket();

    socket.on('notification', (notif: Notification) => {
      setNotifications((prev) => [notif, ...prev]);
      setUnreadCount((c) => c + 1);

      toast(notif.title, { description: notif.message });
    });

    return () => {
      socket.off('notification');
    };
  }, [user, refresh]);

  const markRead = useCallback(async (id: string) => {
    await notificationsApi.markRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    await notificationsApi.markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }, []);

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, markRead, markAllRead, refresh }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}
