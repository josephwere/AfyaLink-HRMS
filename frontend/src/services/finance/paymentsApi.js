import { apiFetch } from "../../utils/apiFetch";

export async function listPayments({ invoiceId, patientId, limit = 25 } = {}) {
  const query = new URLSearchParams();
  if (invoiceId) query.set("invoiceId", String(invoiceId));
  if (patientId) query.set("patientId", String(patientId));
  if (limit) query.set("limit", String(limit));
  return apiFetch(`/api/finance/payments${query.toString() ? `?${query.toString()}` : ""}`);
}

export async function getPayment(id) {
  return apiFetch(`/api/finance/payments/${encodeURIComponent(id)}`);
}

export async function createPayment(payload) {
  return apiFetch("/api/finance/payments", {
    method: "POST",
    body: payload,
  });
}
