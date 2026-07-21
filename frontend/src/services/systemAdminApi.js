import apiFetch from "../utils/apiFetch";
import { downloadApiFile } from "../lib/api/client";
import { guardedConsoleFetch } from "./guardedConsoleFetch";

export const getSystemAdminMetrics = async () => {
  const result = await guardedConsoleFetch("/api/system-admin/metrics", {
    warmupKey: "system-admin-metrics",
  });
  return result?.payload || null;
};

export const getIntegrationHubSummary = async () => {
  return guardedConsoleFetch("/api/system-admin/integration-hub", {
    warmupKey: "system-admin-integration-hub",
  });
};

export const getIntegrationControlPlane = async () => {
  return guardedConsoleFetch("/api/system-admin/integration-control-plane", {
    warmupKey: "system-admin-integration-control-plane",
  });
};

export const getCountyCommandCenterSummary = async (params = {}) => {
  const query = new URLSearchParams();
  if (params.region) query.set("region", params.region);
  const qs = query.toString();
  return guardedConsoleFetch(
    `/api/system-admin/county-command-center${qs ? `?${qs}` : ""}`,
    {
      warmupKey: "system-admin-county-command-center",
    }
  );
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

export const listConnectorSdkTargets = async () => {
  const res = await apiFetch("/api/connectors");
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.items)) return res.items;
  return [];
};

export const getConnectorSdkManifest = async () => {
  return apiFetch("/api/connectors/sdk/manifest");
};

export const getConnectorRuntime = async (connectorId) => {
  if (!connectorId) throw new Error("Connector is required");
  return apiFetch(`/api/connectors/${connectorId}/runtime`);
};

export const updateConnectorRuntime = async (connectorId, payload) => {
  if (!connectorId) throw new Error("Connector is required");
  return apiFetch(`/api/connectors/${connectorId}/runtime`, {
    method: "PATCH",
    body: payload,
  });
};

export const listGovernmentHospitalRegistry = async (params = {}) => {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.status) query.set("status", params.status);
  const qs = query.toString();
  const res = await apiFetch(`/api/system-admin/government-hospitals${qs ? `?${qs}` : ""}`);
  return res?.items || [];
};

export const createGovernmentHospitalRegistryEntry = async (payload) => {
  return apiFetch("/api/system-admin/government-hospitals", {
    method: "POST",
    body: payload,
  });
};

export const importGovernmentHospitalRegistry = async (bulk) => {
  return apiFetch("/api/system-admin/government-hospitals/import", {
    method: "POST",
    body: { bulk },
  });
};

export const listPatientIdentityRegistry = async (params = {}) => {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.country) query.set("country", params.country);
  if (params.status) query.set("status", params.status);
  const qs = query.toString();
  const res = await apiFetch(`/api/system-admin/patient-identity-registry${qs ? `?${qs}` : ""}`);
  return res?.items || [];
};

export const createPatientIdentityRegistryEntry = async (payload) => {
  return apiFetch("/api/system-admin/patient-identity-registry", {
    method: "POST",
    body: payload,
  });
};

export const importPatientIdentityRegistry = async (bulk) => {
  return apiFetch("/api/system-admin/patient-identity-registry/import", {
    method: "POST",
    body: { bulk },
  });
};

export const listClaimRules = async (params = {}) => {
  const query = new URLSearchParams();
  if (params.country) query.set("country", params.country);
  if (params.ruleType) query.set("ruleType", params.ruleType);
  if (params.enabled !== undefined) query.set("enabled", String(params.enabled));
  const qs = query.toString();
  const res = await apiFetch(`/api/system-admin/claim-rules${qs ? `?${qs}` : ""}`);
  return res?.items || [];
};

export const createClaimRule = async (payload) => {
  return apiFetch("/api/system-admin/claim-rules", {
    method: "POST",
    body: payload,
  });
};

export const updateClaimRule = async (id, payload) => {
  return apiFetch(`/api/system-admin/claim-rules/${id}`, {
    method: "PATCH",
    body: payload,
  });
};

export const getHospitalVerificationReviewQueue = async () => {
  return apiFetch("/api/system-admin/hospital-verification/review-queue");
};

export const reviewHospitalVerification = async (id, payload) => {
  return apiFetch(`/api/system-admin/hospital-verification/${id}/review`, {
    method: "PATCH",
    body: payload,
  });
};

export const downloadHospitalVerificationDocument = async (id, docKey) => {
  return downloadApiFile(`/api/system-admin/hospital-verification/${id}/documents/${docKey}`, {
    openInNewTab: true,
  });
};

export const listMigrationProjects = async () => {
  return apiFetch("/api/migrations?limit=50");
};

export const createMigrationProject = async (payload) => {
  return apiFetch("/api/migrations", {
    method: "POST",
    body: payload,
  });
};

export const startMigrationDryRun = async (id) => {
  return apiFetch(`/api/migrations/${id}/dry-run`, { method: "POST" });
};
