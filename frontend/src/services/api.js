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

  if (
    merged.body &&
    typeof merged.body === "object" &&
    !(merged.body instanceof FormData)
  ) {
    merged.body = JSON.stringify(merged.body);
  }

  let r = await fetch(base + path, merged);

  // 🔁 Auto refresh on 401
  if (r.status === 401) {
    const rt = await fetch(base + "/api/auth/refresh", {
      method: "POST",
      credentials: "include",
    });

    if (rt.ok) {
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
