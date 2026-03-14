'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@/lib/types';
import { authApi, setAccessToken } from '@/lib/api';
import { disconnectSocket, reconnectSocket } from '@/lib/socket';

// Proactively refresh 60 seconds before the 15-minute access token expires
const REFRESH_INTERVAL_MS = 14 * 60 * 1000;

// Matches the refresh token lifetime (7 days)
const SESSION_COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

function setSessionCookie() {
  document.cookie = `auth_session=1; path=/; SameSite=Lax; Max-Age=${SESSION_COOKIE_MAX_AGE}`;
}

function clearSessionCookie() {
  document.cookie = 'auth_session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleRefresh = useCallback((onRefresh: () => void) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(onRefresh, REFRESH_INTERVAL_MS);
  }, []);

  const logout = useCallback(async () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    setAccessToken(null);
    setUser(null);
    setToken(null);
    clearSessionCookie();
    disconnectSocket();
    try { await authApi.logout(); } catch { /* fire-and-forget */ }
    router.push('/login');
  }, [router]);

  // Recursive proactive refresh — called every 14 minutes while logged in
  const doRefresh = useCallback(async (): Promise<void> => {
    try {
      const data = await authApi.refresh();
      setAccessToken(data.token);
      setToken(data.token);
      setUser(data.user);
      scheduleRefresh(doRefresh);
    } catch {
      setAccessToken(null);
      setToken(null);
      setUser(null);
      clearSessionCookie();
      disconnectSocket();
      router.push('/login');
    }
  }, [router, scheduleRefresh]);

  const refreshUser = useCallback(async () => {
    try {
      const me = await authApi.me();
      setUser(me);
    } catch {
      await logout();
    }
  }, [logout]);

  // Bootstrap: try to get a new access token via the existing refresh cookie
  useEffect(() => {
    authApi
      .refresh()
      .then((data) => {
        setAccessToken(data.token);
        setToken(data.token);
        setUser(data.user);
        setSessionCookie();
        reconnectSocket();
        scheduleRefresh(doRefresh);
      })
      .catch(() => {
        setAccessToken(null);
        clearSessionCookie();
      })
      .finally(() => setIsLoading(false));

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [doRefresh, scheduleRefresh]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await authApi.login(email, password);
    setAccessToken(data.token);
    setToken(data.token);
    setUser(data.user);
    setSessionCookie();
    reconnectSocket();
    scheduleRefresh(doRefresh);
  }, [doRefresh, scheduleRefresh]);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
