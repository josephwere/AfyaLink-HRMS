import apiFetch from "../utils/apiFetch";

export const getComplianceCenter = async () => apiFetch("/api/compliance/center");

export const createComplianceLegalHold = async (payload) =>
  apiFetch("/api/compliance/legal-holds", {
    method: "POST",
    body: payload,
  });

export const releaseComplianceLegalHold = async (id, payload = {}) =>
  apiFetch(`/api/compliance/legal-holds/${id}/release`, {
    method: "POST",
    body: payload,
  });
