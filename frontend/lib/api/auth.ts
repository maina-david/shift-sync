import axios from "axios";
import { api } from "./client";
import type { User } from "../types";

export const authApi = {
  login: (email: string, password: string) =>
    api.post("/auth/login", { email, password }).then((r) => r.data),
  refresh: () =>
    axios
      .post<{
        token: string;
        user: User;
      }>(`${api.defaults.baseURL}/auth/refresh`, {}, { withCredentials: true })
      .then((r) => r.data),
  logout: () => api.post("/auth/logout").then((r) => r.data),
  me: () => api.get("/auth/me").then((r) => r.data),
};
