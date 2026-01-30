// frontend/src/utils/apiFetch.js

const API_BASE = import.meta.env.VITE_API_URL;

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
    throw new Error(data.msg || data.message || "Request failed");
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
      headers: {
        Accept: "application/json",
      },
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
export { apiFetch, safeJson };
