const BASE = import.meta.env.VITE_API_URL || "";

async function parse(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

let refreshing: Promise<boolean> | null = null;

async function refresh() {
  if (!refreshing) {
    refreshing = fetch(`${BASE}/api/auth/refresh`, { method: "POST", credentials: "include" })
      .then((r) => r.ok)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const doFetch = () =>
    fetch(`${BASE}${path}`, {
      ...init,
      credentials: "include",
      headers,
    });
  let res = await doFetch();
  if (res.status === 401 && !path.includes("/auth/login") && !path.includes("/auth/refresh")) {
    const ok = await refresh();
    if (ok) res = await doFetch();
  }
  return parse(res);
}

export const http = {
  get: <T>(path: string) => api<T>(path),
  post: <T>(path: string, body?: unknown) => api<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) => api<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) => api<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => api<T>(path, { method: "DELETE" }),
};
