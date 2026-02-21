// frontend/src/services/workflowApi.js

import { apiFetch } from "./api";

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
  const res = await apiFetch(`/api/workflows/${encounterId}`);

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to load workflow");
  }

  return res.json();
}

/**
 * Get workflow timeline (audit-safe)
 * - ordered history
 * - actors
 * - timestamps
 */
export async function getWorkflowTimeline(encounterId) {
  const res = await apiFetch(
    `/api/workflows/${encounterId}/timeline`
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to load workflow timeline");
  }

  return res.json();
}
