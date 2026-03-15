import { api } from "./client";
import type { Notification } from "../types";

export const notificationsApi = {
  list: () =>
    api.get("/notifications").then((r) => r.data.items as Notification[]),
  unreadCount: () => api.get("/notifications/unread-count").then((r) => r.data),
  markRead: (id: string) =>
    api.patch(`/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () => api.patch("/notifications/read-all").then((r) => r.data),
};
