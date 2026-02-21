import { apiFetch } from "../utils/apiFetch";

const buildQuery = (options = {}) => {
  const params = new URLSearchParams();
  if (options.limit) params.set("limit", String(options.limit));
  if (options.cursor !== undefined && options.cursor !== null) {
    params.set("cursor", options.cursor);
  }
  if (options.cursorMode) params.set("cursorMode", "1");
  const q = params.toString();
  return q ? `?${q}` : "";
};

export const listReports = (options = {}) =>
  apiFetch(`/api/reports${buildQuery(options)}`);
export const listMyReports = (options = {}) =>
  apiFetch(`/api/reports/mine${buildQuery(options)}`);
export const createReport = (payload) =>
  apiFetch("/api/reports", { method: "POST", body: payload });
export const updateReport = (id, payload) =>
  apiFetch(`/api/reports/${id}`, { method: "PUT", body: payload });
export const deleteReport = (id) =>
  apiFetch(`/api/reports/${id}`, { method: "DELETE" });
