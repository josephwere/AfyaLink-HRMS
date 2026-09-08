import { apiFetch } from "../../utils/apiFetch";

export async function createItem(payload) {
  return apiFetch("/api/pharmacy", {
    method: "POST",
    body: payload,
  });
}

export async function updateItem(id, payload) {
  return apiFetch(`/api/pharmacy/${id}`, {
    method: "PUT",
    body: payload,
  });
}

export async function deleteItem(id) {
  return apiFetch(`/api/pharmacy/${id}`, {
    method: "DELETE",
  });
}

export async function addStock(id, payload) {
  return apiFetch(`/api/pharmacy/${id}/add-stock`, {
    method: "POST",
    body: payload,
  });
}

export async function dispenseStock(id, payload) {
  return apiFetch(`/api/pharmacy/${id}/dispense`, {
    method: "POST",
    body: payload,
  });
}

export async function createSupplier(payload) {
  return apiFetch("/api/pharmacy/suppliers", { method: "POST", body: payload });
}

export async function createPurchaseOrder(payload) {
  return apiFetch("/api/pharmacy/purchase-orders", { method: "POST", body: payload });
}

export async function updatePurchaseOrder(id, payload) {
  return apiFetch(`/api/pharmacy/purchase-orders/${id}`, { method: "PATCH", body: payload });
}

export async function createSupplierRelationship(payload) {
  return apiFetch("/api/pharmacy/supplier-relationships", { method: "POST", body: payload });
}

export async function updateSupplierRelationship(id, payload) {
  return apiFetch(`/api/pharmacy/supplier-relationships/${id}`, { method: "PATCH", body: payload });
}

export async function createRfq(payload) {
  return apiFetch("/api/pharmacy/rfqs", { method: "POST", body: payload });
}

export async function createQuotation(payload) {
  return apiFetch("/api/pharmacy/quotations", { method: "POST", body: payload });
}

export async function awardQuotation(id) {
  return apiFetch(`/api/pharmacy/quotations/${id}/award`, { method: "POST" });
}

export async function createShipment(payload) {
  return apiFetch("/api/pharmacy/shipments", { method: "POST", body: payload });
}

export async function receivePurchaseOrder(id, payload) {
  return apiFetch(`/api/pharmacy/purchase-orders/${id}/receive`, { method: "POST", body: payload });
}

export async function createSupplierInvoice(payload) {
  return apiFetch("/api/pharmacy/supplier-invoices", { method: "POST", body: payload });
}

export async function recordSupplierPayment(payload) {
  return apiFetch("/api/pharmacy/supplier-payments", { method: "POST", body: payload });
}

export async function verifyBatch(payload) {
  return apiFetch("/api/pharmacy/trace/verify-batch", { method: "POST", body: payload });
}

export async function releaseBatch(id, payload) {
  return apiFetch(`/api/pharmacy/trace/batch-controls/${id}/release`, { method: "POST", body: payload });
}

export async function createRecall(payload) {
  return apiFetch("/api/pharmacy/trace/recalls", { method: "POST", body: payload });
}

export async function saveRegulatoryProduct(payload) {
  return apiFetch("/api/pharmacy/trace/regulatory-products", { method: "POST", body: payload });
}

export async function saveSupplierLicense(payload) {
  return apiFetch("/api/pharmacy/trace/supplier-license", { method: "PUT", body: payload });
}

export async function returnBatchToSupplier(payload) {
  return apiFetch("/api/pharmacy/trace/batch-returns", { method: "POST", body: payload });
}

export async function transferBatch(payload) {
  return apiFetch("/api/pharmacy/trace/batch-transfers", { method: "POST", body: payload });
}

export async function transitionSafetySignal(id, payload) {
  return apiFetch(`/api/pharmacy/trace/safety-signals/${id}`, { method: "PATCH", body: payload });
}
