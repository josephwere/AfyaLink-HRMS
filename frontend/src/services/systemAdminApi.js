import api from "./api";

export const getSystemAdminMetrics = async () => {
  const res = await api.get("/api/system-admin/metrics");
  return res.data;
};

export const getRiskPolicy = async () => {
  const res = await api.get("/api/system-admin/risk-policy");
  return res.data?.policy || null;
};

export const updateRiskPolicy = async (payload) => {
  const res = await api.put("/api/system-admin/risk-policy", payload);
  return res.data?.policy || null;
};

export const listAbacPolicies = async (params = {}) => {
  const query = new URLSearchParams();
  if (params.domain) query.set("domain", params.domain);
  if (params.resource) query.set("resource", params.resource);
  if (params.action) query.set("action", params.action);
  if (params.activeOnly) query.set("activeOnly", "1");
  const qs = query.toString();
  const res = await api.get(`/api/system-admin/abac-policies${qs ? `?${qs}` : ""}`);
  return res.data?.items || [];
};

export const createAbacPolicy = async (payload) => {
  const res = await api.post("/api/system-admin/abac-policies", payload);
  return res.data;
};

export const updateAbacPolicy = async (id, payload) => {
  const res = await api.put(`/api/system-admin/abac-policies/${id}`, payload);
  return res.data;
};

export const deleteAbacPolicy = async (id) => {
  const res = await api.delete(`/api/system-admin/abac-policies/${id}`);
  return res.data;
};

export const simulateAbacPolicy = async (payload) => {
  const res = await api.post("/api/system-admin/abac-simulate", payload);
  return res.data;
};

export const listAbacTestCases = async (params = {}) => {
  const query = new URLSearchParams();
  if (params.activeOnly) query.set("activeOnly", "1");
  const qs = query.toString();
  const res = await api.get(`/api/system-admin/abac-test-cases${qs ? `?${qs}` : ""}`);
  return res.data?.items || [];
};

export const createAbacTestCase = async (payload) => {
  const res = await api.post("/api/system-admin/abac-test-cases", payload);
  return res.data;
};

export const updateAbacTestCase = async (id, payload) => {
  const res = await api.put(`/api/system-admin/abac-test-cases/${id}`, payload);
  return res.data;
};

export const deleteAbacTestCase = async (id) => {
  const res = await api.delete(`/api/system-admin/abac-test-cases/${id}`);
  return res.data;
};

export const runAbacTestCase = async (id) => {
  const res = await api.post(`/api/system-admin/abac-test-cases/${id}/run`);
  return res.data;
};

export const runAllAbacTestCases = async () => {
  const res = await api.post("/api/system-admin/abac-test-cases/run-all");
  return res.data;
};
