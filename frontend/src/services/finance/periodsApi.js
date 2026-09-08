import { apiFetch } from "../../utils/apiFetch";

export async function listAccountingPeriods({ status, limit = 50 } = {}) {
  const query = new URLSearchParams();
  if (status) query.set("status", String(status));
  if (limit) query.set("limit", String(limit));
  return apiFetch(`/api/finance/periods${query.toString() ? `?${query.toString()}` : ""}`);
}

export async function getAccountingPeriod(id) {
  return apiFetch(`/api/finance/periods/${encodeURIComponent(id)}`);
}
