import { apiFetch } from "../utils/apiFetch";

export async function fetchAuditLogs(params = {}) {
  const query = new URLSearchParams(params).toString();
  const res = await apiFetch(`/api/audit?${query}`);
  if (!res.ok) throw new Error("Failed to load audit logs");
  return res.json();
}
