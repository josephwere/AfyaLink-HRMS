import { apiFetch } from "../../utils/apiFetch.js";

/**
 * Workflow Domain Queries
 * Read-only operations for workflow definitions, instances, and status.
 * NOTE: Workflow is an orchestration domain that coordinates other domains.
 */

export async function listWorkflows({ q = "", page = 1, limit = 25, status = "" } = {}) {
  const query = new URLSearchParams({ q, page, limit, status }).toString();
  return apiFetch(`/api/workflows?${query}`);
}

export async function getWorkflow(id) {
  return apiFetch(`/api/workflows/${id}`);
}

export async function getWorkflowStatus(id) {
  return apiFetch(`/api/workflows/${id}/status`);
}

export async function getWorkflowSteps(id) {
  return apiFetch(`/api/workflows/${id}/steps`);
}

export async function listWorkflowDefinitions() {
  return apiFetch(`/api/workflows/definitions`);
}
