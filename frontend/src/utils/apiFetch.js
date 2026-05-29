// frontend/src/utils/apiFetch.js

import { canQueueOfflineMutation, queueOfflineMutation } from "./offlineMutation";
import { readStoredUser } from "./browserSession";
import {
  ApiClientError,
  clearApiSession,
  fetchApi as fetchApiJson,
} from "../lib/api/client";

const isDev = typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV;

const inFlightGetRequests = new Map();
const responseCache = new Map();

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data || {};
    this.code = data?.code || null;
  }
}

function toSafeUiMessage(message, { status, code } = {}) {
  const raw = typeof message === "string" ? message : String(message || "");
  if (isDev) return raw || "Request failed";

  // Preserve known user-safe auth/security messages.
  if (code === "STEP_UP_REQUIRED" || code === "SESSION_RESTRICTED") {
    return raw || "Additional verification is required.";
  }

  const lower = raw.toLowerCase();
  const technicalTokens = [
    "backend",
    "frontend",
    "front-end",
    "stack",
    "trace",
    "stacktrace",
    "chunk",
    "module",
    "vite",
    "vercel",
    "node",
    "react",
    "endpoint",
    "http",
    "exception",
  ];

  if (status >= 500) {
    return "We couldn’t complete that request right now. Please try again.";
  }

  if (technicalTokens.some((token) => lower.includes(token))) {
    return "We couldn’t complete that request. Please try again.";
  }

  return raw || "We couldn’t complete that request. Please try again.";
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

function emitUiProgress(type, detail = {}) {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(`afyalink:progress:${type}`, { detail }));
  } catch {
    // ignore
  }
}

function cloneJsonValue(value) {
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch {
      // Fall through to the JSON clone below.
    }
  }
  return JSON.parse(JSON.stringify(value));
}

function buildRequestCacheKey(path, method) {
  const safeMethod = String(method || "GET").toUpperCase();
  const userId = readStoredUser()?.id || "anon";
  let roleOverride = "";
  let strictImpersonation = "0";
  try {
    roleOverride = localStorage.getItem("role_override") || "";
    strictImpersonation = localStorage.getItem("strict_impersonation") === "1" ? "1" : "0";
  } catch {
    // ignore unavailable browser storage
  }
  return [safeMethod, path, userId, roleOverride || "direct", strictImpersonation].join("::");
}

function readResponseCache(cacheKey) {
  const cached = responseCache.get(cacheKey);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    responseCache.delete(cacheKey);
    return null;
  }
  return cloneJsonValue(cached.value);
}

function writeResponseCache(cacheKey, value, ttlMs) {
  if (!cacheKey || !(ttlMs > 0)) return;
  responseCache.set(cacheKey, {
    expiresAt: Date.now() + ttlMs,
    value: cloneJsonValue(value),
  });
}

function clearResponseCaches() {
  responseCache.clear();
  inFlightGetRequests.clear();
}

function shouldQueueMutationAsOffline(err) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return true;
  }

  const status = Number(err?.status || 0);
  if (status === 0) {
    return true;
  }

  if (err instanceof ApiClientError) {
    return err.status === 0;
  }

  return false;
}

/* ======================================================
   CENTRALIZED API FETCH (FINAL)
====================================================== */
async function apiFetch(path, options = {}, _retry = false) {
  const {
    _skipOfflineQueue = false,
    _skipUiProgress = false,
    cacheTtlMs = 0,
    ...requestOptions
  } = options || {};
  const shouldProgress = !_skipUiProgress && !_skipOfflineQueue;
  if (shouldProgress) emitUiProgress("start", { source: "api" });
  const method = String(requestOptions.method || "GET").toUpperCase();
  const shouldUseGetDedupe = !_retry && ["GET", "HEAD"].includes(method);
  const requestCacheKey = shouldUseGetDedupe ? buildRequestCacheKey(path, method) : "";
  const safeCacheTtlMs = Math.max(Number(cacheTtlMs) || 0, 0);

  if (requestCacheKey && safeCacheTtlMs > 0) {
    const cached = readResponseCache(requestCacheKey);
    if (cached) {
      return cached;
    }
  }

  if (requestCacheKey && inFlightGetRequests.has(requestCacheKey)) {
    return inFlightGetRequests.get(requestCacheKey);
  }

  const runRequest = async () => {
    try {
      try {
        const data = await fetchApiJson(path, {
          ...requestOptions,
          timeoutMs: Number(
            requestOptions.timeoutMs ||
              (path.includes("/auth/login") || path.includes("/auth/register") || path.includes("/auth/google")
                ? 16000
                : 12000)
          ),
        });
        if (requestCacheKey && safeCacheTtlMs > 0 && ["GET", "HEAD"].includes(method)) {
          writeResponseCache(requestCacheKey, data, safeCacheTtlMs);
        } else if (!["GET", "HEAD"].includes(method)) {
          clearResponseCaches();
        }
        return data;
      } catch (err) {
        if (
          !_skipOfflineQueue &&
          shouldQueueMutationAsOffline(err) &&
          canQueueOfflineMutation(path, requestOptions.method, requestOptions.body)
        ) {
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
            message: "You're offline. We'll send this automatically when you're back online.",
          };
        }
        if (err instanceof ApiClientError) {
          const data = err.data || {};
          const safeMessage = toSafeUiMessage(err.message, {
            status: err.status,
            code: err.code,
          });
          const wrapped = new ApiError(safeMessage, err.status, data);
          if (
            wrapped.code === "STEP_UP_REQUIRED" ||
            wrapped.code === "SESSION_RESTRICTED"
          ) {
            window.dispatchEvent(
              new CustomEvent("afyalink:session-security", {
                detail: {
                  code: wrapped.code,
                  message: wrapped.message,
                  restriction: data?.restriction || null,
                },
              })
            );
          }
          throw wrapped;
        }
        const fallbackError = new ApiError(
          toSafeUiMessage(err?.message || "Request failed", { status: err?.status || 0, code: err?.code || "" }),
          err?.status || 0,
          err?.data || {}
        );
        throw fallbackError;
      }
    } finally {
      if (shouldProgress) emitUiProgress("done", { source: "api" });
    }
  };

  if (!requestCacheKey) {
    return runRequest();
  }

  const requestPromise = runRequest().finally(() => {
    inFlightGetRequests.delete(requestCacheKey);
  });
  inFlightGetRequests.set(requestCacheKey, requestPromise);
  return requestPromise;
}

/* ======================================================
   LOGOUT
====================================================== */
export function logout() {
  clearResponseCaches();
  clearApiSession("SIGNED_OUT");
}

export default apiFetch;
export { apiFetch, safeJson, ApiError };
