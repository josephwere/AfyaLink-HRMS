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

export const getPatientById = (patientId) =>
  apiFetch(`/api/patients/${encodeURIComponent(patientId)}`);

export const getPatient = getPatientById;

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

export const getMyProfile = () => apiFetch("/api/profile");

export const getMyFamily = (options = {}) => {
  const params = new URLSearchParams();
  if (options.limit) params.set("limit", String(options.limit));
  const query = params.toString();
  return apiFetch(`/api/profile/family${query ? `?${query}` : ""}`);
};

export const getMyFamilyTimeline = (options = {}) => {
  const params = new URLSearchParams();
  if (options.limit) params.set("limit", String(options.limit));
  const query = params.toString();
  return apiFetch(`/api/profile/family/timeline${query ? `?${query}` : ""}`);
};

export const listMarketplaceHospitals = (options = {}) => {
  const params = new URLSearchParams();
  if (options.q) params.set("q", options.q);
  if (options.limit) params.set("limit", String(options.limit));
  if (options.lat) params.set("lat", String(options.lat));
  if (options.lng) params.set("lng", String(options.lng));
  if (options.radiusKm) params.set("radiusKm", String(options.radiusKm));
  const query = params.toString();
  return apiFetch(`/api/hospitals/marketplace${query ? `?${query}` : ""}`);
};

export const listVerifiedHospitals = (options = {}) => {
  const params = new URLSearchParams();
  if (options.q) params.set("q", options.q);
  if (options.limit) params.set("limit", String(options.limit));
  if (options.page) params.set("page", String(options.page));
  // Support status=VERIFIED and active=true to mirror backend filter
  params.set("status", "VERIFIED");
  params.set("active", "true");
  const query = params.toString();
  return apiFetch(`/api/hospitals${query ? `?${query}` : ""}`);
};

export const listMyPrescriptions = () => apiFetch("/api/pharmacy/prescriptions");

export const createPatient = (payload) => apiFetch("/api/patients", { method: "POST", body: payload });

export const updatePatient = (patientId, payload) =>
  apiFetch(`/api/patients/${encodeURIComponent(patientId)}`, { method: "PUT", body: payload });

export const createPatientVitals = (patientId, payload) =>
  apiFetch(`/api/patients/${encodeURIComponent(patientId)}/vitals`, { method: "POST", body: payload });

export const initializeStripePaymentIntent = (payload) =>
  apiFetch("/api/payments/stripe/create-intent", { method: "POST", body: payload });

export const initializeMpesaPayment = (payload) =>
  apiFetch("/api/payments/mpesa/stk", { method: "POST", body: payload });

export const initializeFlutterwavePayment = (payload) =>
  apiFetch("/api/payments/flutter/init", { method: "POST", body: payload });

export const searchGuardians = (q = "") => {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  const query = params.toString();
  return apiFetch(`/api/patients/guardians/search${query ? `?${query}` : ""}`);
};

export default {
  listPatients,
  getPatientById,
  getPatient,
  selfRegisterMinorPatient,
  requestFamilyAnchorApprovalOtp,
  verifyFamilyAnchorApprovalOtp,
  getMyProfile,
  getMyFamily,
  getMyFamilyTimeline,
  listMarketplaceHospitals,
  listMyPrescriptions,
  createPatient,
  updatePatient,
  createPatientVitals,
  initializeStripePaymentIntent,
  initializeMpesaPayment,
  initializeFlutterwavePayment,
};
