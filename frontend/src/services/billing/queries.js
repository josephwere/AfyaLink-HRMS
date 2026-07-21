import { apiFetch } from "../../utils/apiFetch";

export async function listInvoices({ patientId, encounterId, status, limit = 25 } = {}) {
  const query = new URLSearchParams();
  if (patientId) query.set("patientId", String(patientId));
  if (encounterId) query.set("encounterId", String(encounterId));
  if (status) query.set("status", String(status));
  if (limit) query.set("limit", String(limit));
  const qs = query.toString();
  return apiFetch(`/api/billing/invoices${qs ? `?${qs}` : ""}`);
}

export async function getInvoice(id) {
  return apiFetch(`/api/billing/invoices/${encodeURIComponent(id)}`);
}

export async function getInvoiceSummary({ patientId, encounterId } = {}) {
  const query = new URLSearchParams();
  if (patientId) query.set("patientId", String(patientId));
  if (encounterId) query.set("encounterId", String(encounterId));
  const qs = query.toString();
  return apiFetch(`/api/billing/summary${qs ? `?${qs}` : ""}`);
}

export async function listFinancials({ page = 1, limit = 25 } = {}) {
  const query = new URLSearchParams();
  query.set("page", String(page));
  query.set("limit", String(limit));
  return apiFetch(`/api/financials?${query.toString()}`);
}

export const list = listInvoices;
export const get = getInvoice;
export const getSummary = getInvoiceSummary;
export const listFinancial = listFinancials;
