import { apiFetch } from "../../utils/apiFetch";

export async function listReconciliationItems({ period, type, limit = 50 } = {}) {
  const query = new URLSearchParams();
  if (period) query.set("period", String(period));
  if (type) query.set("type", String(type));
  if (limit) query.set("limit", String(limit));
  return apiFetch(`/api/finance/reconciliation${query.toString() ? `?${query.toString()}` : ""}`);
}

export async function getReconciliationSummary(reconciliationId) {
  return apiFetch(`/api/finance/reconciliation/${encodeURIComponent(reconciliationId)}`);
}
