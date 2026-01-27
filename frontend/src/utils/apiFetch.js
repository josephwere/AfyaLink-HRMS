// src/utils/apiFetch.js

const API_BASE = import.meta.env.VITE_API_URL;

/* ======================================================
   SAFE JSON PARSER (NO DOUBLE-CONSUME)
====================================================== */
async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

/* ======================================================
   CENTRALIZED API FETCH (FIXED)
====================================================== */
async function apiFetch(path, options = {}, _retry = false) {
  const token = localStorage.getItem("token");

  const headers = {
    ...(options.headers || {}),
  };

  // 🚫 NEVER attach token to auth routes
  const isAuthRoute =
    path.includes("/auth/login") ||
    path.includes("/auth/register") ||
    path.includes("/auth/google") ||
    path.includes("/auth/resend");

  if (token && !isAuthRoute) {
    headers.Authorization = `Bearer ${token}`;
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

  // 🔁 Handle 401 BEFORE reading body
  if (response.status === 401 && !_retry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return apiFetch(path, options, true);
    }
  }

  const data = await safeJson(response);

  if (!response.ok) {
    throw new Error(data.msg || "Request failed");
  }

  return data;
}

/* ======================================================
   REFRESH ACCESS TOKEN
====================================================== */
async function refreshAccessToken() {
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });

    if (!res.ok) return false;

    const data = await safeJson(res);

    if (!data?.accessToken) return false;

    localStorage.setItem("token", data.accessToken);
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
  window.location.href = "/login";
}

export default apiFetch;
export { apiFetch };
