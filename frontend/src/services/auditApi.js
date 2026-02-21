import { apiFetch } from "../utils/apiFetch";

export async function fetchAuditLogs(params = {}) {
  const query = new URLSearchParams(params).toString();
  const data = await apiFetch(`/api/audit?${query}`);
  return data;
}

export async function fetchEvidenceBundle(params = {}) {
  const query = new URLSearchParams(params).toString();
  const data = await apiFetch(`/api/audit/evidence-bundle?${query}`);
  return data;
}
