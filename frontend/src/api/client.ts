import { buildApiUrl, fetchApi } from "../lib/api/client";

export const api = {
  defaults: {
    baseURL: buildApiUrl("/api"),
    withCredentials: true,
  },
  get: async (path: string) => ({ data: await fetchApi(path, { method: "GET" }) }),
  post: async (path: string, body?: unknown) => ({ data: await fetchApi(path, { method: "POST", body }) }),
  put: async (path: string, body?: unknown) => ({ data: await fetchApi(path, { method: "PUT", body }) }),
  patch: async (path: string, body?: unknown) => ({ data: await fetchApi(path, { method: "PATCH", body }) }),
  delete: async (path: string) => ({ data: await fetchApi(path, { method: "DELETE" }) }),
};
