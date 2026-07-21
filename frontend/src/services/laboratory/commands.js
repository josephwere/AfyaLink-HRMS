import { apiFetch } from "../../utils/apiFetch.js";

/**
 * Laboratory Domain Commands
 * Write and action operations for laboratory workflows.
 */

export async function submitSample(payload) {
  return apiFetch("/api/laboratory/samples", {
    method: "POST",
    body: payload,
  });
}

export async function approveSample(sampleId, payload = {}) {
  return apiFetch(`/api/laboratory/samples/${sampleId}/approve`, {
    method: "POST",
    body: payload,
  });
}

export async function rejectSample(sampleId, payload = {}) {
  return apiFetch(`/api/laboratory/samples/${sampleId}/reject`, {
    method: "POST",
    body: payload,
  });
}

export async function submitResult(sampleId, payload) {
  return apiFetch(`/api/laboratory/samples/${sampleId}/results`, {
    method: "POST",
    body: payload,
  });
}

export async function approveResult(resultId, payload = {}) {
  return apiFetch(`/api/laboratory/results/${resultId}/approve`, {
    method: "POST",
    body: payload,
  });
}

export async function rejectResult(resultId, payload = {}) {
  return apiFetch(`/api/laboratory/results/${resultId}/reject`, {
    method: "POST",
    body: payload,
  });
}

export async function markTestComplete(testId, payload = {}) {
  return apiFetch(`/api/laboratory/tests/${testId}/complete`, {
    method: "POST",
    body: payload,
  });
}

export async function completeEncounterLab(encounterId, payload = {}) {
  return apiFetch("/api/labs/complete", {
    method: "POST",
    body: { encounterId, ...payload },
  });
}
