import { apiFetch } from "../../utils/apiFetch";

export async function getCurrentShift() {
  return apiFetch(`/api/finance/shifts/current`);
}

export async function listShifts({ cashierId, status, limit = 50 } = {}) {
  const q = new URLSearchParams();
  if (cashierId) q.set("cashierId", String(cashierId));
  if (status) q.set("status", String(status));
  if (limit) q.set("limit", String(limit));
  return apiFetch(`/api/finance/shifts${q.toString() ? `?${q.toString()}` : ""}`);
}

export async function openShift(payload) {
  return apiFetch(`/api/finance/shifts`, {
    method: "POST",
    body: payload,
  });
}

export async function closeShift(id, payload) {
  return apiFetch(`/api/finance/shifts/${encodeURIComponent(id)}/close`, {
    method: "POST",
    body: payload,
  });
}

export async function getShift(id) {
  return apiFetch(`/api/finance/shifts/${encodeURIComponent(id)}`);
}

export async function approveShift(id, payload) {
  return apiFetch(`/api/finance/shifts/${encodeURIComponent(id)}/approve`, {
    method: "POST",
    body: payload,
  });
}

export async function rejectShift(id, reason) {
  return apiFetch(`/api/finance/shifts/${encodeURIComponent(id)}/reject`, {
    method: "POST",
    body: { reason },
  });
}

export async function reopenShift(id) {
  return apiFetch(`/api/finance/shifts/${encodeURIComponent(id)}/reopen`, {
    method: "POST",
  });
}
