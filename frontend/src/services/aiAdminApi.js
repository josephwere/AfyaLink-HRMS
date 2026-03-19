import apiFetch from "../utils/apiFetch";

export const listAiAdminLogs = async (params = {}) => {
  const query = new URLSearchParams();
  if (params.action) query.set("action", params.action);
  if (params.actions) {
    const actions = Array.isArray(params.actions) ? params.actions.join(",") : String(params.actions);
    if (actions) query.set("actions", actions);
  }
  if (params.limit) query.set("limit", String(params.limit));
  if (params.hospital) query.set("hospital", String(params.hospital));
  if (params.hospitalKey) query.set("hospitalKey", String(params.hospitalKey));
  const qs = query.toString();
  return apiFetch(`/api/ai_admin/list${qs ? `?${qs}` : ""}`);
};

export default { listAiAdminLogs };
