import { apiFetch } from "../../utils/apiFetch";

export async function listItems({ q, page = 1, limit = 25 } = {}) {
  const query = new URLSearchParams({ q, page, limit }).toString();
  return apiFetch(`/api/pharmacy?${query}`);
}

export async function listAvailableMedicines({ q = "", limit = 200, includeOutOfStock = false } = {}) {
  const query = new URLSearchParams({
    q,
    limit,
    includeOutOfStock: includeOutOfStock ? "true" : "false",
  }).toString();
  return apiFetch(`/api/pharmacy/available-medicines?${query}`);
}

export async function getItem(id) {
  return apiFetch(`/api/pharmacy/${id}`);
}

export async function listSuppliers() {
  return apiFetch("/api/pharmacy/suppliers");
}

export async function listPurchaseOrders() {
  return apiFetch("/api/pharmacy/purchase-orders");
}

export async function listStockRisks() {
  return apiFetch("/api/pharmacy/stock-risks");
}

export async function listSupplierRelationships() {
  return apiFetch("/api/pharmacy/supplier-relationships");
}

export async function listSupplierProducts(supplierId) {
  const query = supplierId ? `?supplierId=${encodeURIComponent(supplierId)}` : "";
  return apiFetch(`/api/pharmacy/supplier-products${query}`);
}

export async function listRfqs() {
  return apiFetch("/api/pharmacy/rfqs");
}

export async function listQuotations() {
  return apiFetch("/api/pharmacy/quotations");
}

export async function listRegulatoryProducts(params = {}) {
  const query = new URLSearchParams(params).toString();
  return apiFetch(`/api/pharmacy/trace/regulatory-products${query ? `?${query}` : ""}`);
}

export async function listBatchControls(hospitalId) {
  const query = hospitalId ? `?hospitalId=${encodeURIComponent(hospitalId)}` : "";
  return apiFetch(`/api/pharmacy/trace/batch-controls${query}`);
}

export async function listRecalls() {
  return apiFetch("/api/pharmacy/trace/recalls");
}

export async function listSupplierCompliance() {
  return apiFetch("/api/pharmacy/trace/supplier-compliance");
}

export async function listSafetySignals() {
  return apiFetch("/api/pharmacy/trace/safety-signals");
}

export async function getNationalSafetyMetrics() {
  return apiFetch("/api/government/pharmacy/metrics");
}
