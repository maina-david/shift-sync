import { api } from "./client";
import type { SystemSetting } from "../types";

export const settingsApi = {
  list: (): Promise<SystemSetting[]> =>
    api.get("/settings").then((r) => r.data),
  update: (
    key: string,
    patch: {
      value?: unknown;
      description?: string | null;
      isEnabled?: boolean;
    },
  ) =>
    api
      .patch(`/settings/${encodeURIComponent(key)}`, patch)
      .then((r) => r.data),
  reset: () => api.post("/settings/reset").then((r) => r.data),
};
