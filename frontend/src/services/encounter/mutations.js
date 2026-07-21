import { apiFetch } from "../../utils/apiFetch";

export async function create(payload) {
  return apiFetch(`/api/encounters`, {
    method: "POST",
    body: payload,
  });
}

export const createEncounter = create;

export async function close(encounterId) {
  return apiFetch(`/api/encounters/${encodeURIComponent(encounterId)}/close`, {
    method: "POST",
  });
}

export const closeEncounter = close;

export async function applyCloseoutEffects(encounterId, payload) {
  return apiFetch(`/api/encounters/${encodeURIComponent(encounterId)}/closeout-effects`, {
    method: "POST",
    body: payload,
  });
}

export async function createBillingHandoff(encounterId, payload) {
  return apiFetch(`/api/encounters/${encodeURIComponent(encounterId)}/billing-handoff`, {
    method: "POST",
    body: payload,
  });
}

export async function resolveNurseEscalation(encounterId, payload) {
  return apiFetch(`/api/encounters/${encodeURIComponent(encounterId)}/nurse-escalation-resolve`, {
    method: "POST",
    body: payload,
  });
}
