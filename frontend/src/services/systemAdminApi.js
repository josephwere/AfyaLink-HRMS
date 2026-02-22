import apiFetch from "../utils/apiFetch";

export const getSystemAdminMetrics = async () => {
  return apiFetch("/api/system-admin/metrics");
};

export const getRiskPolicy = async () => {
  const res = await apiFetch("/api/system-admin/risk-policy");
  return res?.policy || null;
};

export const updateRiskPolicy = async (payload) => {
  const res = await apiFetch("/api/system-admin/risk-policy", {
    method: "PUT",
    body: payload,
  });
  return res?.policy || null;
};

export const listAbacPolicies = async (params = {}) => {
  const query = new URLSearchParams();
  if (params.domain) query.set("domain", params.domain);
  if (params.resource) query.set("resource", params.resource);
  if (params.action) query.set("action", params.action);
  if (params.activeOnly) query.set("activeOnly", "1");
  const qs = query.toString();
  const res = await apiFetch(`/api/system-admin/abac-policies${qs ? `?${qs}` : ""}`);
  return res?.items || [];
};

export const createAbacPolicy = async (payload) => {
  return apiFetch("/api/system-admin/abac-policies", {
    method: "POST",
    body: payload,
  });
};

export const updateAbacPolicy = async (id, payload) => {
  return apiFetch(`/api/system-admin/abac-policies/${id}`, {
    method: "PUT",
    body: payload,
  });
};

export const deleteAbacPolicy = async (id) => {
  return apiFetch(`/api/system-admin/abac-policies/${id}`, {
    method: "DELETE",
  });
};

export const simulateAbacPolicy = async (payload) => {
  return apiFetch("/api/system-admin/abac-simulate", {
    method: "POST",
    body: payload,
  });
};

export const listAbacTestCases = async (params = {}) => {
  const query = new URLSearchParams();
  if (params.activeOnly) query.set("activeOnly", "1");
  const qs = query.toString();
  const res = await apiFetch(`/api/system-admin/abac-test-cases${qs ? `?${qs}` : ""}`);
  return res?.items || [];
};

export const createAbacTestCase = async (payload) => {
  return apiFetch("/api/system-admin/abac-test-cases", {
    method: "POST",
    body: payload,
  });
};

export const updateAbacTestCase = async (id, payload) => {
  return apiFetch(`/api/system-admin/abac-test-cases/${id}`, {
    method: "PUT",
    body: payload,
  });
};

export const deleteAbacTestCase = async (id) => {
  return apiFetch(`/api/system-admin/abac-test-cases/${id}`, {
    method: "DELETE",
  });
};

export const runAbacTestCase = async (id) => {
  return apiFetch(`/api/system-admin/abac-test-cases/${id}/run`, {
    method: "POST",
  });
};

export const runAllAbacTestCases = async () => {
  return apiFetch("/api/system-admin/abac-test-cases/run-all", {
    method: "POST",
  });
};
