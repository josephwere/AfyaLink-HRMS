import { canQueueOfflineMutation, queueOfflineMutation } from "../utils/offlineMutation";
import { getAccessToken, setAccessToken } from "../utils/browserSession";
import { resolveApiBase } from "../utils/networkBase";

const base = resolveApiBase(import.meta.env.VITE_API_URL || window.__ENV__?.API_URL || "");

function makeQueuedResponse(path, method, body) {
  queueOfflineMutation({ path, method, body, feature: "API_SERVICE" });
  return {
    ok: true,
    status: 202,
    async json() {
      return {
        queued: true,
        offlineQueued: true,
        message: "Offline: action queued and will sync automatically.",
      };
    },
  };
}

/* ======================================================
   LOW-LEVEL FETCH (USED INTERNALLY)
====================================================== */
async function apiFetch(path, opts = {}) {
  const defaults = {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  };

  const merged = { ...defaults, ...opts };
  const token = getAccessToken();
  const isAuthRoute =
    path.includes("/api/auth/login") ||
    path.includes("/api/auth/register") ||
    path.includes("/api/auth/google");

  if (
    merged.body &&
    typeof merged.body === "object" &&
    !(merged.body instanceof FormData)
  ) {
    merged.body = JSON.stringify(merged.body);
  }

  if (token && !isAuthRoute) {
    const viewRole = localStorage.getItem("role_override");
    const strictImpersonation = localStorage.getItem("strict_impersonation") === "1";
    merged.headers = {
      ...merged.headers,
      Authorization: `Bearer ${token}`,
      ...(viewRole ? { "X-Afya-View-Role": viewRole } : {}),
      ...(viewRole && strictImpersonation ? { "X-Afya-Strict-Impersonation": "1" } : {}),
    };
  }

  let r;
  try {
    r = await fetch(base + path, merged);
  } catch (err) {
    if (canQueueOfflineMutation(path, merged.method, merged.body)) {
      return makeQueuedResponse(path, merged.method, merged.body);
    }
    throw err;
  }

  // 🔁 Auto refresh on 401
  if (r.status === 401) {
    const rt = await fetch(base + "/api/auth/refresh", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (rt.ok) {
      const data = await rt.json();
      if (data?.accessToken) {
        setAccessToken(data.accessToken);
        merged.headers = {
          ...merged.headers,
          Authorization: `Bearer ${data.accessToken}`,
        };
      }
      try {
        r = await fetch(base + path, merged);
      } catch (err) {
        if (canQueueOfflineMutation(path, merged.method, merged.body)) {
          return makeQueuedResponse(path, merged.method, merged.body);
        }
        throw err;
      }
    }
  }

  return r;
}

/* ======================================================
   DEFAULT API (AXIOS-LIKE INTERFACE)
   👉 This fixes the Vite build error
====================================================== */
const api = {
  get: async (path) => {
    const r = await apiFetch(path);
    return { data: await r.json() };
  },

  post: async (path, body) => {
    const r = await apiFetch(path, {
      method: "POST",
      body,
    });
    return { data: await r.json() };
  },

  put: async (path, body) => {
    const r = await apiFetch(path, {
      method: "PUT",
      body,
    });
    return { data: await r.json() };
  },

  patch: async (path, body) => {
    const r = await apiFetch(path, {
      method: "PATCH",
      body,
    });
    return { data: await r.json() };
  },

  delete: async (path) => {
    const r = await apiFetch(path, {
      method: "DELETE",
    });
    return { data: await r.json() };
  },
};

export default api;
export { apiFetch };
