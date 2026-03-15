import axios, { AxiosError } from "axios";

const API_BASE = (() => {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url && process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXT_PUBLIC_API_URL environment variable is required in production",
    );
  }
  return url || "http://localhost:3001";
})();

let _accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  _accessToken = token;
  if (token) _redirecting = false;
}

export function getAccessToken(): string | null {
  return _accessToken;
}

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (_accessToken) config.headers.Authorization = `Bearer ${_accessToken}`;
  return config;
});

let _refreshPromise: Promise<string | null> | null = null;
let _redirecting = false;

async function tryRefresh(): Promise<string | null> {
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = axios
    .post<{ token: string }>(
      `${API_BASE}/auth/refresh`,
      {},
      { withCredentials: true },
    )
    .then((r) => {
      _accessToken = r.data.token;
      return r.data.token;
    })
    .catch(() => {
      _accessToken = null;
      return null;
    })
    .finally(() => {
      _refreshPromise = null;
    });
  return _refreshPromise;
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as typeof error.config & { _retry?: boolean };
    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !original.url?.includes("/auth/refresh") &&
      !original.url?.includes("/auth/login")
    ) {
      original._retry = true;
      const newToken = await tryRefresh();
      if (newToken) {
        original.headers = original.headers ?? {};
        original.headers["Authorization"] = `Bearer ${newToken}`;
        return api(original);
      }
      if (typeof window !== "undefined" && !_redirecting) {
        _redirecting = true;
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

export function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data;
    if (typeof data?.message === "string") return data.message;
    if (Array.isArray(data?.message)) return data.message.join(", ");
    if (data?.violations) {
      return (data.violations as { message: string }[])
        .map((v) => v.message)
        .join("; ");
    }
  }
  if (err instanceof Error) return err.message;
  return "An unexpected error occurred";
}
