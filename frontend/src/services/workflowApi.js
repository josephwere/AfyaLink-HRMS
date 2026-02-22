// frontend/src/services/workflowApi.js

import apiFetch from "../utils/apiFetch";

/**
 * ================================
 * WORKFLOW API (READ-ONLY)
 * ================================
 * Frontend MUST NOT infer state.
 * Backend is the only authority.
 */

/**
 * Get full workflow object
 * - current state
 * - allowed transitions
 */
export async function getWorkflow(encounterId) {
  return apiFetch(`/api/workflows/${encounterId}`);
}

/**
 * Get workflow timeline (audit-safe)
 * - ordered history
 * - actors
 * - timestamps
 */
export async function getWorkflowTimeline(encounterId) {
  return apiFetch(`/api/workflows/${encounterId}/timeline`);
}
