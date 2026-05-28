import { canQueueOfflineMutation, queueOfflineMutation } from "../utils/offlineMutation";
import {
  buildApiUrl,
  fetchApi,
  fetchApiResponse,
} from "../lib/api/client";

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
  let r;
  try {
    r = await fetchApiResponse(path, opts);
  } catch (err) {
    if (canQueueOfflineMutation(path, opts?.method, opts?.body)) {
      return makeQueuedResponse(path, opts?.method, opts?.body);
    }
    throw err;
  }
  return r;
}

/* ======================================================
   DEFAULT API (AXIOS-LIKE INTERFACE)
   👉 This fixes the Vite build error
====================================================== */
const api = {
  get: async (path) => {
    return { data: await fetchApi(path) };
  },

  post: async (path, body) => {
    return { data: await fetchApi(path, { method: "POST", body }) };
  },

  put: async (path, body) => {
    return { data: await fetchApi(path, { method: "PUT", body }) };
  },

  patch: async (path, body) => {
    return { data: await fetchApi(path, { method: "PATCH", body }) };
  },

  delete: async (path) => {
    return { data: await fetchApi(path, { method: "DELETE" }) };
  },
};

export default api;
export { apiFetch, buildApiUrl };
