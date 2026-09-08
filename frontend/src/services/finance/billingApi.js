import { apiFetch } from "../../utils/apiFetch";

export async function listInvoices({ patientId, encounterId, status, limit = 25 } = {}) {
  const query = new URLSearchParams();
  if (patientId) query.set("patientId", String(patientId));
  if (encounterId) query.set("encounterId", String(encounterId));
  if (status) query.set("status", String(status));
  if (limit) query.set("limit", String(limit));
  return apiFetch(`/api/finance/invoices${query.toString() ? `?${query.toString()}` : ""}`);
}

export async function getInvoice(id) {
  return apiFetch(`/api/finance/invoices/${encodeURIComponent(id)}`);
}

export async function createInvoice(payload) {
  return apiFetch("/api/finance/invoices", {
    method: "POST",
    body: payload,
  });
}

export async function voidInvoice(id, payload) {
  return apiFetch(`/api/finance/invoices/${encodeURIComponent(id)}/void`, {
    method: "POST",
    body: payload,
  });
}
