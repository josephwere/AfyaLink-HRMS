import api from "./api";

export const listAiAdminLogs = async (params = {}) => {
  const query = new URLSearchParams();
  if (params.action) query.set("action", params.action);
  if (params.limit) query.set("limit", String(params.limit));
  if (params.hospital) query.set("hospital", String(params.hospital));
  const qs = query.toString();
  const res = await api.get(`/api/ai_admin/list${qs ? `?${qs}` : ""}`);
  return res.data;
};

export default { listAiAdminLogs };

