import { apiFetch } from "../../utils/apiFetch";

export async function listChartOfAccounts({ segment, limit = 100 } = {}) {
  const query = new URLSearchParams();
  if (segment) query.set("segment", String(segment));
  if (limit) query.set("limit", String(limit));
  return apiFetch(`/api/finance/chart-of-accounts${query.toString() ? `?${query.toString()}` : ""}`);
}

export async function getAccount(accountId) {
  return apiFetch(`/api/finance/chart-of-accounts/${encodeURIComponent(accountId)}`);
}
