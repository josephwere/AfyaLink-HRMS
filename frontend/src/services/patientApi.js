import { apiFetch } from "../utils/apiFetch";

const buildQuery = (options = {}) => {
  const params = new URLSearchParams();
  if (options.q) params.set("q", options.q);
  if (options.limit) params.set("limit", String(options.limit));
  if (options.cursor !== undefined && options.cursor !== null) {
    params.set("cursor", options.cursor);
  }
  if (options.cursorMode) params.set("cursorMode", "1");
  const q = params.toString();
  return q ? `?${q}` : "";
};

export const listPatients = (options = {}) =>
  apiFetch(`/api/patients${buildQuery(options)}`);

export const selfRegisterMinorPatient = (payload) =>
  apiFetch("/api/patients/self-register-minor", {
    method: "POST",
    body: payload,
  });

export const requestFamilyAnchorApprovalOtp = (payload) =>
  apiFetch("/api/patients/family-anchor/request-otp", {
    method: "POST",
    body: payload,
  });

export const verifyFamilyAnchorApprovalOtp = (payload) =>
  apiFetch("/api/patients/family-anchor/verify-otp", {
    method: "POST",
    body: payload,
  });

export const getMyFamilyTimeline = (options = {}) => {
  const params = new URLSearchParams();
  if (options.limit) params.set("limit", String(options.limit));
  const query = params.toString();
  return apiFetch(`/api/profile/family/timeline${query ? `?${query}` : ""}`);
};
