const base = import.meta.env.VITE_API_URL || "";

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
  const token = localStorage.getItem("token");
  const refreshToken = localStorage.getItem("refreshToken");
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
    merged.headers = {
      ...merged.headers,
      Authorization: `Bearer ${token}`,
      ...(viewRole ? { "X-Afya-View-Role": viewRole } : {}),
    };
  }

  let r = await fetch(base + path, merged);

  // 🔁 Auto refresh on 401
  if (r.status === 401 && refreshToken) {
    const rt = await fetch(base + "/api/auth/refresh", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (rt.ok) {
      const data = await rt.json();
      if (data?.accessToken) {
        localStorage.setItem("token", data.accessToken);
        merged.headers = {
          ...merged.headers,
          Authorization: `Bearer ${data.accessToken}`,
        };
      }
      if (data?.refreshToken) {
        localStorage.setItem("refreshToken", data.refreshToken);
      }
      r = await fetch(base + path, merged);
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

  delete: async (path) => {
    const r = await apiFetch(path, {
      method: "DELETE",
    });
    return { data: await r.json() };
  },
};

export default api;
export { apiFetch };
