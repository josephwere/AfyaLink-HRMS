import { apiFetch } from "../../utils/apiFetch.js";

/**
 * Workflow Domain Commands
 * Orchestration commands that coordinate across multiple domains.
 * Workflow itself doesn't perform clinical actions - it orchestrates other domains.
 */

export async function createWorkflow(payload) {
  return apiFetch("/api/workflows", {
    method: "POST",
    body: payload,
  });
}

export async function startWorkflow(id, payload = {}) {
  return apiFetch(`/api/workflows/${id}/start`, {
    method: "POST",
    body: payload,
  });
}

export async function executeStep(workflowId, stepId, payload = {}) {
  return apiFetch(`/api/workflows/${workflowId}/steps/${stepId}/execute`, {
    method: "POST",
    body: payload,
  });
}

export async function completeWorkflow(id, payload = {}) {
  return apiFetch(`/api/workflows/${id}/complete`, {
    method: "POST",
    body: payload,
  });
}

export async function failWorkflow(id, payload = {}) {
  return apiFetch(`/api/workflows/${id}/fail`, {
    method: "POST",
    body: payload,
  });
}

export async function pauseWorkflow(id, payload = {}) {
  return apiFetch(`/api/workflows/${id}/pause`, {
    method: "POST",
    body: payload,
  });
}
