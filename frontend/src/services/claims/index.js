import { apiFetch } from "../../utils/apiFetch";

function buildQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || String(value).trim() === "") return;
    query.set(key, String(value));
  });
  return query.toString();
}

export async function listClaims({ limit = 50 } = {}) {
  return apiFetch(`/api/claims?limit=${limit}`);
}

export async function listAlerts({ status = "OPEN" } = {}) {
  return apiFetch(`/api/claims/alerts?status=${encodeURIComponent(status)}`);
}

export async function getSummary() {
  return apiFetch("/api/claims/summary");
}

export async function getAuditTrail(claimId) {
  return apiFetch(`/api/claims/${encodeURIComponent(claimId)}/audit`);
}

export async function reviewClaim(claimId, { decision, notes = "" } = {}) {
  return apiFetch(`/api/claims/${encodeURIComponent(claimId)}/review`, {
    method: "POST",
    body: { decision, notes },
  });
}

export async function getGovernmentOverview(filters = {}) {
  const qs = buildQuery(filters);
  return apiFetch(`/api/government/overview${qs ? `?${qs}` : ""}`);
}

export async function listGovernmentClaims(filters = {}) {
  const qs = buildQuery(filters);
  return apiFetch(`/api/government/claims${qs ? `?${qs}` : ""}`);
}

export async function listGovernmentAlerts(filters = {}) {
  const qs = buildQuery(filters);
  return apiFetch(`/api/claims/alerts${qs ? `?${qs}` : ""}`);
}

export async function listGovernmentHospitals(filters = {}) {
  const qs = buildQuery(filters);
  return apiFetch(`/api/government/hospitals${qs ? `?${qs}` : ""}`);
}

export async function listGovernmentInspections(filters = {}) {
  const qs = buildQuery(filters);
  return apiFetch(`/api/government/inspections${qs ? `?${qs}` : ""}`);
}

export async function listGovernmentEnforcements(filters = {}) {
  const qs = buildQuery(filters);
  return apiFetch(`/api/government/enforcement${qs ? `?${qs}` : ""}`);
}

export async function listGovernmentHealthFunds(filters = {}) {
  const qs = buildQuery(filters);
  return apiFetch(`/api/government/health-funds${qs ? `?${qs}` : ""}`);
}

export async function getGovernmentAuditLogs() {
  return apiFetch("/api/government/audit-logs?limit=200");
}

export async function getGovernmentNotifications() {
  return apiFetch("/api/government/notifications");
}

export async function getGovernmentPatientHistory(query) {
  return apiFetch(`/api/claims/government/patient-history?q=${encodeURIComponent(query)}`);
}

export async function getClaimAuditTrail(claimId) {
  return apiFetch(`/api/claims/${encodeURIComponent(claimId)}/audit`);
}

export async function requestVerification(claimId, notes = "") {
  return apiFetch(`/api/claims/${encodeURIComponent(claimId)}/request-verification`, {
    method: "POST",
    body: { notes },
  });
}

export async function assignAudit(claimId, role = "GOVERNMENT_AUDITOR", assigneeId = null) {
  return apiFetch(`/api/claims/${encodeURIComponent(claimId)}/assign`, {
    method: "POST",
    body: { role, assigneeId },
  });
}

export async function createInspection(payload) {
  return apiFetch("/api/government/inspections", {
    method: "POST",
    body: payload,
  });
}

export async function updateInspectionStatus(id, status) {
  return apiFetch(`/api/government/inspections/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: { status },
  });
}

export async function createEnforcement(payload) {
  return apiFetch("/api/government/enforcement", {
    method: "POST",
    body: payload,
  });
}

export async function updateEnforcementStatus(id, status) {
  return apiFetch(`/api/government/enforcement/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: { status, resolved: status === "RESOLVED" },
  });
}

export async function createHealthFund(payload) {
  return apiFetch("/api/government/health-funds", {
    method: "POST",
    body: payload,
  });
}

export async function updateHealthFund(id, payload) {
  return apiFetch(`/api/government/health-funds/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: payload,
  });
}

export default {
  listClaims,
  listAlerts,
  getSummary,
  getAuditTrail,
  reviewClaim,
  getGovernmentOverview,
  listGovernmentClaims,
  listGovernmentAlerts,
  listGovernmentHospitals,
  listGovernmentInspections,
  listGovernmentEnforcements,
  listGovernmentHealthFunds,
  getGovernmentAuditLogs,
  getGovernmentNotifications,
  getGovernmentPatientHistory,
  getClaimAuditTrail,
  requestVerification,
  assignAudit,
  createInspection,
  updateInspectionStatus,
  createEnforcement,
  updateEnforcementStatus,
  createHealthFund,
  updateHealthFund,
};
