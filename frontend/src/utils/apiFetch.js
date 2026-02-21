// frontend/src/utils/apiFetch.js

const API_BASE = import.meta.env.VITE_API_URL;

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
  const token = localStorage.getItem("token");

  const headers = {
    Accept: "application/json",
    ...(options.headers || {}),
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
    if (viewRole) {
      headers["X-Afya-View-Role"] = viewRole;
    }
  }

  if (options.body && typeof options.body === "object") {
    options.body = JSON.stringify(options.body);
    headers["Content-Type"] = "application/json";
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: "include",
      headers,
    });
  } catch {
    throw new Error("Network error. Please check your connection.");
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
