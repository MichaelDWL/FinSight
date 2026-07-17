const API_BASE_URL = window.FINSIGHT_API_URL || "http://localhost:3045/api";

const AUTH_NO_REFRESH = new Set([
  "/auth/login",
  "/auth/register",
  "/auth/refresh",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/verify-email",
]);

function getCookie(name) {
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${name.replace(/[$()*+.?[\\\]^{|}]/g, "\\$&")}=([^;]*)`)
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function shouldAttemptRefresh(path) {
  return !AUTH_NO_REFRESH.has(path);
}

async function request(path, options = {}, retried = false) {
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  const method = (options.method || "GET").toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const csrf = getCookie("finsight_csrf");
    if (csrf) headers["X-CSRF-Token"] = csrf;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response.json().catch(() => null);

  if (
    response.status === 401 &&
    shouldAttemptRefresh(path) &&
    !retried
  ) {
    const refreshed = await tryRefreshSession();
    if (refreshed) {
      return request(path, options, true);
    }
    window.dispatchEvent(new CustomEvent("finsight:session-expired"));
  }

  if (!response.ok || payload?.success === false) {
    const error = new Error(payload?.message || "Nao foi possivel comunicar com a API.");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload?.data ?? null;
}

let refreshPromise = null;

export async function tryRefreshSession() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body }),
  put: (path, body) => request(path, { method: "PUT", body }),
  patch: (path, body) => request(path, { method: "PATCH", body }),
  delete: (path) => request(path, { method: "DELETE" }),
};

export const authApi = {
  login: (body) => api.post("/auth/login", body),
  register: (body) => api.post("/auth/register", body),
  logout: () => api.post("/auth/logout"),
  me: () => api.get("/auth/me"),
  forgotPassword: (body) => api.post("/auth/forgot-password", body),
  resetPassword: (body) => api.post("/auth/reset-password", body),
  sessions: () => api.get("/auth/sessions"),
  revokeSession: (sessionId) => api.delete(`/auth/sessions/${sessionId}`),
  revokeAllSessions: () => api.delete("/auth/sessions"),
};
