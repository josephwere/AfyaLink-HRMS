import {
  clearBrowserSession,
  getAccessToken,
  readStoredUser,
  setAccessToken,
  writeStoredUser,
} from "../../utils/browserSession";
import { assertSecureApiBase, resolveApiBase } from "../../utils/networkBase";

export { exportRichTextDocument } from "../../utils/fileExport";

export const AUTH_EXPIRED_EVENT = "afyalink:auth-expired";

const isDev =
  typeof import.meta !== "undefined" &&
  import.meta.env &&
  import.meta.env.DEV;

let refreshPromise = null;

export class ApiClientError extends Error {
  constructor(message, status = 0, data = null) {
    super(message);
    this.name = "ApiClientError";
    this.status = Number(status || 0);
    this.data = data || null;
    this.code = data?.code || "";
  }
}

function getEnvApiBase() {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return (
      import.meta.env.VITE_API_BASE_URL ||
      import.meta.env.VITE_API_URL ||
      import.meta.env.NEXT_PUBLIC_API_BASE_URL ||
      ""
    );
  }
  return "";
}

function getWindowApiBase() {
  if (typeof window === "undefined") return "";
  return window.__ENV__?.API_BASE_URL || window.__ENV__?.API_URL || "";
}

export function getConfiguredApiBase() {
  return getEnvApiBase() || getWindowApiBase() || "";
}

export function getApiBase() {
  return resolveApiBase(getConfiguredApiBase()).replace(/\/+$/, "");
}

export function buildApiUrl(path = "") {
  const normalizedPath = String(path || "").startsWith("/")
    ? String(path || "")
    : `/${String(path || "")}`;
  return `${getApiBase()}${normalizedPath}`;
}

function isAuthRoute(path = "") {
  return (
    path.includes("/api/auth/login") ||
    path.includes("/api/auth/register") ||
    path.includes("/api/auth/google") ||
    path.includes("/api/auth/refresh")
  );
}

function cloneHeaders(input = {}) {
  if (input instanceof Headers) {
    return Object.fromEntries(input.entries());
  }
  return { ...(input || {}) };
}

function buildRoleHeaders(headers = {}) {
  const nextHeaders = { ...headers };
  try {
    const viewRole = localStorage.getItem("role_override");
    const strictImpersonation =
      localStorage.getItem("strict_impersonation") === "1";
    if (viewRole) {
      nextHeaders["X-Afya-View-Role"] = viewRole;
      if (strictImpersonation) {
        nextHeaders["X-Afya-Strict-Impersonation"] = "1";
      }
    }
  } catch {
    // ignore unavailable storage
  }
  return nextHeaders;
}

function buildContextHeaders(headers = {}) {
  const nextHeaders = { ...headers };
  try {
    const contextMode = localStorage.getItem("afyalink_user_context_mode");
    if (contextMode) {
      nextHeaders["X-AfyaLink-Context"] = contextMode;
    }
  } catch {
    // ignore unavailable storage
  }
  return nextHeaders;
}

export function buildApiHeaders(
  headers = {},
  { includeAuth = true, path = "" } = {}
) {
  const nextHeaders = buildContextHeaders(buildRoleHeaders(cloneHeaders(headers)));
  if (!("Accept" in nextHeaders)) {
    nextHeaders.Accept = "application/json";
  }
  const token = getAccessToken();
  if (includeAuth && token && !isAuthRoute(path)) {
    nextHeaders.Authorization = `Bearer ${token}`;
  }
  return nextHeaders;
}

function emitAuthExpired(detail = {}) {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent(AUTH_EXPIRED_EVENT, {
        detail,
      })
    );
  } catch {
    // ignore event issues
  }
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function toNetworkErrorMessage(error) {
  if (error?.name === "AbortError") {
    return "This request is taking longer than usual. Please try again.";
  }
  return "Network error. Please check your connection and try again.";
}

export async function refreshAccessToken() {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const base = getApiBase();
      assertSecureApiBase(base);
      const response = await fetch(`${base}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) return null;
      const data = (await safeJson(response)) || {};
      if (!data?.accessToken) return null;

      setAccessToken(data.accessToken);
      if (data?.user) {
        writeStoredUser(data.user);
      }
      return data;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function request(path, options = {}, { retryOn401 = true } = {}) {
  const {
    timeoutMs = 15000,
    includeAuth = true,
    credentials = "include",
    headers: providedHeaders,
    body,
    ...rest
  } = options || {};

  const url = buildApiUrl(path);
  assertSecureApiBase(getApiBase());

  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(
    () => controller.abort(),
    Number(timeoutMs || 15000)
  );

  try {
    let finalBody = body;
    const headers = buildApiHeaders(providedHeaders, { includeAuth, path });

    if (
      finalBody &&
      typeof finalBody === "object" &&
      !(finalBody instanceof FormData) &&
      !(finalBody instanceof Blob)
    ) {
      finalBody = JSON.stringify(finalBody);
      if (!headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
      }
    }

    let response;
    try {
      response = await fetch(url, {
        ...rest,
        body: finalBody,
        credentials,
        headers,
        signal: controller.signal,
      });
    } catch (error) {
      throw new ApiClientError(toNetworkErrorMessage(error), 0, null);
    }

    if (response.status === 401 && retryOn401 && !isAuthRoute(path)) {
      const refreshed = await refreshAccessToken();
      if (refreshed?.accessToken) {
        return request(path, options, { retryOn401: false });
      }

      clearBrowserSession();
      emitAuthExpired({
        status: 401,
        path,
        reason: "SESSION_EXPIRED",
      });
      throw new ApiClientError("Session expired. Please sign in again.", 401, {
        code: "SESSION_EXPIRED",
      });
    }

    return response;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

function toUiErrorMessage(message, status = 0, code = "") {
  const raw = typeof message === "string" ? message.trim() : "";
  if (isDev && raw) return raw;
  if (code === "STEP_UP_REQUIRED" || code === "SESSION_RESTRICTED") {
    return raw || "Additional verification is required.";
  }
  if (status >= 500) {
    return "We couldn’t complete that request right now. Please try again.";
  }
  return raw || "We couldn’t complete that request. Please try again.";
}

export async function fetchApiResponse(path, options = {}) {
  const response = await request(path, options);
  if (response.ok) return response;

  const data = await safeJson(response);
  throw new ApiClientError(
    toUiErrorMessage(data?.msg || data?.message || response.statusText, response.status, data?.code),
    response.status,
    data
  );
}

export async function fetchApi(path, options = {}) {
  const response = await fetchApiResponse(path, options);
  const contentType = String(response.headers.get("content-type") || "");
  if (!contentType.includes("application/json")) {
    return null;
  }
  return (await safeJson(response)) || {};
}

export async function downloadApiFile(
  path,
  { filename = "", timeoutMs = 20000, headers = {}, openInNewTab = false } = {}
) {
  const response = await fetchApiResponse(path, {
    method: "GET",
    timeoutMs,
    headers,
  });
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);

  if (openInNewTab) {
    window.open(url, "_blank", "noopener,noreferrer");
    globalThis.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return { blob, url };
  }

  if (filename) {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
  globalThis.setTimeout(() => URL.revokeObjectURL(url), 0);
  return { blob, url };
}

export function clearApiSession(reason = "SIGNED_OUT") {
  clearBrowserSession();
  emitAuthExpired({ reason, status: 401 });
}

export function getStoredSessionUser() {
  return readStoredUser();
}
