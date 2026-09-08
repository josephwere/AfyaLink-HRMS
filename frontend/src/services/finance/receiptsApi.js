import { apiFetch } from "../../utils/apiFetch";

export async function listReceipts({ paymentId, patientId, limit = 25 } = {}) {
  const query = new URLSearchParams();
  if (paymentId) query.set("paymentId", String(paymentId));
  if (patientId) query.set("patientId", String(patientId));
  if (limit) query.set("limit", String(limit));
  return apiFetch(`/api/finance/receipts${query.toString() ? `?${query.toString()}` : ""}`);
}

export async function getReceipt(id) {
  return apiFetch(`/api/finance/receipts/${encodeURIComponent(id)}`);
}
