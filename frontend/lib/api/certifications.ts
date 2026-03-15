import { api } from "./client";
import type { Certification, User } from "../types";

export const certificationsApi = {
  getMine: (): Promise<Certification[]> =>
    api.get("/certifications/mine").then((r) => r.data),
  getForUser: (userId: string): Promise<Certification[]> =>
    api.get(`/certifications/user/${userId}`).then((r) => r.data),
  getExpiring: (days?: number): Promise<(Certification & { user: User })[]> =>
    api
      .get("/certifications/expiring", { params: days ? { days } : undefined })
      .then((r) => r.data),
  create: (
    userId: string,
    data: {
      name: string;
      issuedDate: string;
      expiryDate: string;
      documentUrl?: string;
      issuer?: string;
    },
  ) => api.post(`/certifications/user/${userId}`, data).then((r) => r.data),
  remove: (id: string) =>
    api.delete(`/certifications/${id}`).then((r) => r.data),
};
