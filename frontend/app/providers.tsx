"use client";

import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/auth-context";
import { NotificationsProvider } from "@/contexts/notifications-context";
import { MessagesProvider } from "@/contexts/messages-context";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            retry: 3,
            retryDelay: (attemptIndex) =>
              Math.min(1000 * 2 ** attemptIndex, 30_000),
          },
        },
      }),
  );

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      storageKey="shiftsync-theme"
      enableSystem={false}
    >
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <NotificationsProvider>
            <MessagesProvider>{children}</MessagesProvider>
          </NotificationsProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
