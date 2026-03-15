import { api } from "./client";
import type { Bookmark } from "../types";

export const bookmarksApi = {
  list: (): Promise<Bookmark[]> => api.get("/bookmarks").then((r) => r.data),
  create: (data: { label: string; href: string }): Promise<Bookmark> =>
    api.post("/bookmarks", data).then((r) => r.data),
  remove: (id: string) => api.delete(`/bookmarks/${id}`).then((r) => r.data),
};
