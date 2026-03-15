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
  isLoading: boolean;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  refresh: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    const [notifs, { count }] = await Promise.all([
      notificationsApi.list(),
      notificationsApi.unreadCount(),
    ]);
    setNotifications(notifs);
    setUnreadCount(count);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    refresh();

    const socket = getSocket();

    const handler = (notif: Notification) => {
      setNotifications((prev) => [notif, ...prev]);
      setUnreadCount((c) => c + 1);

      const type = notif.type?.toUpperCase() ?? '';
      const isCritical = [
        'SHIFT_UNCOVERED', 'UNCOVERED_SHIFT', 'SHIFT_CANCELLED',
        'SCHEDULE_UNPUBLISHED', 'CERT_EXPIRY_WARNING',
      ].some((t) => type.includes(t));
      const isInfo = [
        'WEEKLY_SUMMARY', 'REPORT_READY',
      ].some((t) => type.includes(t));

      if (isCritical) {
        toast.error(notif.title, { description: notif.message, duration: Infinity });
      } else if (isInfo) {
        // info-only: badge only, no toast
      } else {
        toast(notif.title, { description: notif.message, duration: 6000 });
      }
    };

    socket.on('notification', handler);

    return () => {
      socket.off('notification', handler);
    };
  }, [user, refresh]);

  const markRead = useCallback(async (id: string) => {
    // Optimistic: mark as read instantly, revert on error
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await notificationsApi.markRead(id);
    } catch {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: false } : n)),
      );
      setUnreadCount((c) => c + 1);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      toast.error('Failed to mark notifications as read');
    }
  }, []);

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, isLoading, markRead, markAllRead, refresh }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}
