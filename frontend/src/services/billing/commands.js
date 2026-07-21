import { apiFetch } from "../../utils/apiFetch";

export async function createInvoice(payload) {
  return apiFetch("/api/billing/invoices", {
    method: "POST",
    body: payload,
  });
}

export async function finalizeInvoice(id, payload) {
  return apiFetch(`/api/billing/invoices/${encodeURIComponent(id)}/finalize`, {
    method: "POST",
    body: payload,
  });
}

export async function voidInvoice(id, payload) {
  return apiFetch(`/api/billing/invoices/${encodeURIComponent(id)}/void`, {
    method: "POST",
    body: payload,
  });
}

export async function createPayment(payload) {
  return apiFetch("/api/billing/payments", {
    method: "POST",
    body: payload,
  });
}

export async function createFinancial(payload) {
  return apiFetch("/api/financials", {
    method: "POST",
    body: payload,
  });
}

export async function payFinancial(id, amount, method = "Card", reference = "WEB") {
  return apiFetch(`/api/financials/${encodeURIComponent(id)}/pay`, {
    method: "POST",
    body: { amount, method, reference },
  });
}

export async function claimFinancial(id, provider) {
  return apiFetch(`/api/financials/${encodeURIComponent(id)}/claim`, {
    method: "POST",
    body: { provider },
  });
}

export const create = createInvoice;
