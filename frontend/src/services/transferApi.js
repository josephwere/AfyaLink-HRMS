import apiFetch from "../utils/apiFetch";

export const listTransfers = async (params = {}) => {
  const storedStatus = localStorage.getItem("afyalink_transfer_status") || "";
  const storedScope = localStorage.getItem("afyalink_transfer_scope") || "";
  const query = new URLSearchParams();
  if (params.status || storedStatus) query.set("status", params.status || storedStatus);
  if (params.limit) query.set("limit", String(params.limit));
  if (params.page) query.set("page", String(params.page));
  if (params.cursor) query.set("cursor", params.cursor);
  if (params.scope || storedScope) query.set("scope", params.scope || storedScope);
  if (params.hospitalId) query.set("hospitalId", params.hospitalId);
  const qs = query.toString();
  return apiFetch(`/api/transfers${qs ? `?${qs}` : ""}`);
};

export const listMyTransfers = async (params = {}) => {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.limit) query.set("limit", String(params.limit));
  if (params.page) query.set("page", String(params.page));
  const qs = query.toString();
  return apiFetch(`/api/transfers/mine${qs ? `?${qs}` : ""}`);
};

export const getTransferCommandCenterOverview = async (params = {}) => {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return apiFetch(`/api/transfers/command-center/overview${qs ? `?${qs}` : ""}`);
};

export const requestTransfer = async (payload) => {
  return apiFetch(`/api/transfers`, {
    method: "POST",
    body: payload,
  });
};

export const approveTransfer = async (transferId) => {
  return apiFetch(`/api/transfers/${transferId}/approve`, { method: "POST" });
};

export const rejectTransfer = async (transferId, reason = "") => {
  return apiFetch(`/api/transfers/${transferId}/reject`, {
    method: "POST",
    body: { reason },
  });
};

export const completeTransfer = async (transferId, { forceComplete = false } = {}) => {
  return apiFetch(`/api/transfers/${transferId}/complete`, {
    method: "POST",
    body: { forceComplete },
  });
};

export const grantTransferConsent = async (transferId, payload = {}) => {
  return apiFetch(`/api/transfers/${transferId}/consent/grant`, {
    method: "POST",
    body: payload,
  });
};

export const revokeTransferConsent = async (transferId) => {
  return apiFetch(`/api/transfers/${transferId}/consent/revoke`, {
    method: "POST",
  });
};

export const patientGrantTransferConsent = async (transferId, payload = {}) => {
  return apiFetch(`/api/transfers/${transferId}/consent/patient-grant`, {
    method: "POST",
    body: payload,
  });
};

export const patientRevokeTransferConsent = async (transferId) => {
  return apiFetch(`/api/transfers/${transferId}/consent/patient-revoke`, {
    method: "POST",
  });
};

export const verifyTransferProvenance = async ({ transferId, payload, signature }) => {
  return apiFetch(`/api/transfers/${transferId}/provenance/verify`, {
    method: "POST",
    body: {
      payload,
      signature,
    },
  });
};

export const getTransferHandoverPackage = async (transferId) => {
  return apiFetch(`/api/transfers/${transferId}/handover-package`);
};

export const getTransferConsent = async (transferId) => {
  return apiFetch(`/api/transfers/${transferId}/consent`);
};

export const getTransferAuditTrail = async (transferId) => {
  return apiFetch(`/api/transfers/${transferId}/audit`);
};

export default {
  listTransfers,
  listMyTransfers,
  getTransferCommandCenterOverview,
  requestTransfer,
  approveTransfer,
  rejectTransfer,
  completeTransfer,
  grantTransferConsent,
  revokeTransferConsent,
  patientGrantTransferConsent,
  patientRevokeTransferConsent,
  verifyTransferProvenance,
  getTransferHandoverPackage,
  getTransferConsent,
  getTransferAuditTrail,
};
