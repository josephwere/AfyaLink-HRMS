import { apiFetch } from "../../utils/apiFetch";

export async function getGeneralLedger({ accountId, period, limit = 50 } = {}) {
  const query = new URLSearchParams();
  if (accountId) query.set("accountId", String(accountId));
  if (period) query.set("period", String(period));
  if (limit) query.set("limit", String(limit));
  return apiFetch(`/api/finance/general-ledger${query.toString() ? `?${query.toString()}` : ""}`);
}

export async function getJournalEntries({ accountId, fromDate, toDate, limit = 50 } = {}) {
  const query = new URLSearchParams();
  if (accountId) query.set("accountId", String(accountId));
  if (fromDate) query.set("fromDate", String(fromDate));
  if (toDate) query.set("toDate", String(toDate));
  if (limit) query.set("limit", String(limit));
  return apiFetch(`/api/finance/journals${query.toString() ? `?${query.toString()}` : ""}`);
}
