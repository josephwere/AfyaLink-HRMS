// src/utils/apiFetch.js

const API_BASE = import.meta.env.VITE_API_URL;

/* ======================================================
   SAFE JSON PARSER (NO CRASH ON EMPTY BODY)
====================================================== */
export async function safeJson(res) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text }; // fallback: return raw text if not valid JSON
  }
}

/* ======================================================
   CENTRALIZED API FETCH
====================================================== */
async function apiFetch(path, options = {}, _retry = false) {
  const token = localStorage.getItem("token");

  const headers = {
    ...(options.headers || {}),
  };

  // Skip Authorization header for login
  if (token && !path.includes("/auth/login")) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Auto‑stringify body if it’s an object
  if (options.body) {
    if (typeof options.body === "object") {
      options.body = JSON.stringify(options.body);
    }
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

  // 🔎 Log response details for debugging
  const data = await safeJson(response);
  if (!response.ok) {
    console.error("API Error:", {
      status: response.status,
      statusText: response.statusText,
      path,
      data,
    });
    throw new Error(
      `Request failed: ${response.status} ${response.statusText} — ${JSON.stringify(data)}`
    );
  }

  /* 🔁 Silent refresh (once) */
  if (response.status === 401 && !_retry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return apiFetch(path, options, true);
    }
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

    if (!res.ok) {
      logout();
      return false;
    }

    const data = await safeJson(res);

    if (!data?.accessToken) {
      logout();
      return false;
    }

    localStorage.setItem("token", data.accessToken);
    return true;
  } catch {
    logout();
    return false;
  }
}

/* ======================================================
   LOGOUT HELPER
====================================================== */
export function logout() {
  localStorage.removeItem("token");
  window.location.href = "/login";
}

/* EXPORTS */
export default apiFetch;
export { apiFetch };
