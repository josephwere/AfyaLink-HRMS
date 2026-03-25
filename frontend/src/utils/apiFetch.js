// frontend/src/utils/apiFetch.js

import { canQueueOfflineMutation, queueOfflineMutation } from "./offlineMutation";

const FALLBACK_API_BASE =
  typeof window !== "undefined"
    ? (() => {
        const host = window.location.hostname;
        const origin = window.location.origin;
        const isLocal = host === "localhost" || host === "127.0.0.1";
        return isLocal ? `${window.location.protocol}//${host}:5000` : origin;
      })()
    : "http://localhost:5000";
const API_BASE =
  import.meta.env.VITE_API_URL ||
  window.__ENV__?.API_URL ||
  FALLBACK_API_BASE;

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data || {};
    this.code = data?.code || null;
  }
}

/* ======================================================
   SAFE JSON PARSER
====================================================== */
async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

/* ======================================================
   CENTRALIZED API FETCH (FINAL)
====================================================== */
async function apiFetch(path, options = {}, _retry = false) {
  const { _skipOfflineQueue = false, ...requestOptions } = options || {};
  const token = localStorage.getItem("token");

  const headers = {
    Accept: "application/json",
    ...(requestOptions.headers || {}),
  };

  /* ----------------------------------
     AUTH ROUTES (NO TOKEN / NO REFRESH)
  ----------------------------------- */
  const isAuthRoute =
    path.includes("/auth/login") ||
    path.includes("/auth/register") ||
    path.includes("/auth/google");

  if (token && !isAuthRoute) {
    headers.Authorization = `Bearer ${token}`;
    const viewRole = localStorage.getItem("role_override");
    const strictImpersonation = localStorage.getItem("strict_impersonation") === "1";
    if (viewRole) {
      headers["X-Afya-View-Role"] = viewRole;
      if (strictImpersonation) {
        headers["X-Afya-Strict-Impersonation"] = "1";
      }
    }
  }

  if (
    requestOptions.body &&
    typeof requestOptions.body === "object" &&
    !(requestOptions.body instanceof FormData) &&
    !(requestOptions.body instanceof Blob)
  ) {
    requestOptions.body = JSON.stringify(requestOptions.body);
    headers["Content-Type"] = "application/json";
  }

  const timeoutMs = Number(requestOptions.timeoutMs || (isAuthRoute ? 20000 : 15000));
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...requestOptions,
      credentials: "include",
      headers,
      signal: controller.signal,
    });
  } catch (err) {
    if (!_skipOfflineQueue && canQueueOfflineMutation(path, requestOptions.method, requestOptions.body)) {
      queueOfflineMutation({
        path,
        method: requestOptions.method || "POST",
        body: requestOptions.body,
        feature: "API_FETCH",
      });
      return {
        ok: true,
        queued: true,
        offlineQueued: true,
        message: "Offline: action queued and will sync automatically.",
      };
    }
    if (err?.name === "AbortError") {
      throw new Error("This request is taking longer than usual. Please try again.");
    }
    throw new Error("Network error. Please check your connection.");
  } finally {
    clearTimeout(timeoutId);
  }

  /* ----------------------------------
     401 → TRY REFRESH (ONCE, NON-AUTH)
  ----------------------------------- */
  if (response.status === 401 && !_retry && !isAuthRoute) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return apiFetch(path, options, true);
    }

    // hard logout if refresh fails
    logout();
    throw new Error("Session expired. Please sign in again.");
  }

  const data = await safeJson(response);

  if (!response.ok) {
    const err = new ApiError(
      data.msg || data.message || "Request failed",
      response.status,
      data
    );
    if (
      err.code === "STEP_UP_REQUIRED" ||
      err.code === "SESSION_RESTRICTED"
    ) {
      window.dispatchEvent(
        new CustomEvent("afyalink:session-security", {
          detail: {
            code: err.code,
            message: err.message,
            restriction: data?.restriction || null,
          },
        })
      );
    }
    throw err;
  }

  return data;
}

/* ======================================================
   REFRESH ACCESS TOKEN
====================================================== */
async function refreshAccessToken() {
  try {
    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) return false;

    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) return false;

    const data = await safeJson(res);

    if (!data?.accessToken) return false;

    localStorage.setItem("token", data.accessToken);
    if (data.refreshToken) {
      localStorage.setItem("refreshToken", data.refreshToken);
    }
    return true;
  } catch {
    return false;
  }
}

/* ======================================================
   LOGOUT
====================================================== */
export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
  window.location.href = "/login";
}

export default apiFetch;
export { apiFetch, safeJson, ApiError };
