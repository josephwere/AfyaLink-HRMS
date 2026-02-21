import api from "./api";

export const listTransfers = async (params = {}) => {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.limit) query.set("limit", String(params.limit));
  if (params.page) query.set("page", String(params.page));
  if (params.cursor) query.set("cursor", params.cursor);
  const qs = query.toString();
  const res = await api.get(`/api/transfers${qs ? `?${qs}` : ""}`);
  return res.data;
};

export const verifyTransferProvenance = async ({ transferId, payload, signature }) => {
  const res = await api.post(`/api/transfers/${transferId}/provenance/verify`, {
    payload,
    signature,
  });
  return res.data;
};

export default { listTransfers, verifyTransferProvenance };

