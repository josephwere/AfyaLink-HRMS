import apiFetch from "../utils/apiFetch";

export const listTransfers = async (params = {}) => {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.limit) query.set("limit", String(params.limit));
  if (params.page) query.set("page", String(params.page));
  if (params.cursor) query.set("cursor", params.cursor);
  const qs = query.toString();
  return apiFetch(`/api/transfers${qs ? `?${qs}` : ""}`);
};

export const getTransferCommandCenterOverview = async (params = {}) => {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return apiFetch(`/api/transfers/command-center/overview${qs ? `?${qs}` : ""}`);
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
  getTransferCommandCenterOverview,
  verifyTransferProvenance,
  getTransferHandoverPackage,
  getTransferConsent,
  getTransferAuditTrail,
};
