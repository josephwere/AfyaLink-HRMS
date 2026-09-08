import { apiFetch } from "../../utils/apiFetch";

export async function getFinancialReports({ type, period, limit = 25 } = {}) {
  const query = new URLSearchParams();
  if (type) query.set("type", String(type));
  if (period) query.set("period", String(period));
  if (limit) query.set("limit", String(limit));
  return apiFetch(`/api/finance/reports${query.toString() ? `?${query.toString()}` : ""}`);
}

export async function getReportDetail(reportId) {
  return apiFetch(`/api/finance/reports/${encodeURIComponent(reportId)}`);
}
