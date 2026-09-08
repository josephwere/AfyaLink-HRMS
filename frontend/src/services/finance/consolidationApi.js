import { apiFetch } from "../../utils/apiFetch";

export async function listConsolidations({ period, status, limit = 25 } = {}) {
  const query = new URLSearchParams();
  if (period) query.set("period", String(period));
  if (status) query.set("status", String(status));
  if (limit) query.set("limit", String(limit));
  return apiFetch(`/api/finance/consolidation${query.toString() ? `?${query.toString()}` : ""}`);
}

export async function getConsolidation(id) {
  return apiFetch(`/api/finance/consolidation/${encodeURIComponent(id)}`);
}
