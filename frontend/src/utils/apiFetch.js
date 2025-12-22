// src/utils/apiFetch.js

const API_BASE = import.meta.env.VITE_API_URL;

/**
 * Centralized API fetch with:
 * - Access token header
 * - HttpOnly refresh cookie
 * - Silent refresh on 401
 * - Infinite-loop protection
 */
export async function apiFetch(path, options = {}, _retry = false) {
  const token = localStorage.getItem("token");

  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  // Only set JSON header when body exists
  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  let response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: "include", // 🔑 REQUIRED for refresh cookie
      headers,
    });
  } catch {
    throw new Error("Network error. Please check your connection.");
  }

  // 🔁 Silent refresh (once)
  if (response.status === 401 && !_retry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return apiFetch(path, options, true);
    }
  }

  return response;
}

/**
 * Refresh access token using HttpOnly cookie
 */
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

    const data = await res.json();

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

/**
 * Logout helper
 */
export function logout() {
  localStorage.removeItem("token");
  window.location.href = "/login";
}
