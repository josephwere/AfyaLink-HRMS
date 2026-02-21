import { apiFetch } from "../utils/apiFetch";

export const getLiveOccupancy = () => apiFetch("/api/security/live");
export const getOverstays = () => apiFetch("/api/security/overstays");
export const getSecurityAlerts = () => apiFetch("/api/security/alerts");
export const getAccessLogs = (params = {}) => {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.limit) q.set("limit", String(params.limit));
  if (params.cursor) q.set("cursor", String(params.cursor));
  const qs = q.toString();
  return apiFetch(`/api/security/logs${qs ? `?${qs}` : ""}`);
};

export const bookVisitorAccess = (payload) =>
  apiFetch("/api/access-bookings/visitor", { method: "POST", body: payload });

export const bookInternalAccess = (payload) =>
  apiFetch("/api/access-bookings/internal", { method: "POST", body: payload });

export const verifyAccessCode = (payload) =>
  apiFetch("/api/access/verify", { method: "POST", body: payload });

export const checkInAccess = (payload) =>
  apiFetch("/api/access/check-in", { method: "POST", body: payload });

export const checkOutAccess = (payload) =>
  apiFetch("/api/access/check-out", { method: "POST", body: payload });

export const searchUsersForAccess = ({ q = "", role = "", hospital = "", limit = 20 } = {}) => {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (role) params.set("role", role);
  if (hospital) params.set("hospital", hospital);
  params.set("limit", String(limit));
  return apiFetch(`/api/users?${params.toString()}`);
};
