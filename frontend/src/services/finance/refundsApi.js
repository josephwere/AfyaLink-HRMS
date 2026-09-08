import { apiFetch } from "../../utils/apiFetch";

export async function listRefunds({ paymentId, patientId, status, limit = 25 } = {}) {
  const query = new URLSearchParams();
  if (paymentId) query.set("paymentId", String(paymentId));
  if (patientId) query.set("patientId", String(patientId));
  if (status) query.set("status", String(status));
  if (limit) query.set("limit", String(limit));
  return apiFetch(`/api/finance/refunds${query.toString() ? `?${query.toString()}` : ""}`);
}

export async function createRefund(payload) {
  return apiFetch("/api/finance/refunds", {
    method: "POST",
    body: payload,
  });
}
