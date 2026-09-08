import { apiFetch } from "../../utils/apiFetch";

export async function listPolicies() {
  return apiFetch(`/api/approval-policies`);
}

export async function createPolicy(payload) {
  return apiFetch(`/api/approval-policies`, { method: "POST", body: payload });
}

export async function getPolicy(id) {
  return apiFetch(`/api/approval-policies/${encodeURIComponent(id)}`);
}

export async function updatePolicy(id, payload) {
  return apiFetch(`/api/approval-policies/${encodeURIComponent(id)}`, { method: "PUT", body: payload });
}

export async function deletePolicy(id) {
  return apiFetch(`/api/approval-policies/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function simulatePolicy({ workflowType, amount }) {
  return apiFetch(`/api/approval-policies/simulate`, { method: "POST", body: { workflowType, amount } });
}
