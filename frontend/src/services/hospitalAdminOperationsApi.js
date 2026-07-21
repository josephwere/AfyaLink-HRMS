import { apiFetch } from "../utils/apiFetch";
import { fetchApi, downloadApiFile } from "../lib/api/client";
import {
  approveTransfer as approveTransferRequest,
  completeTransfer as completeTransferRequest,
  getTransferAuditTrail as getTransferAuditTrailRequest,
  getTransferCommandCenterOverview as getTransferCommandCenterOverviewRequest,
  getTransferConsent as getTransferConsentRequest,
  getTransferHandoverPackage as getTransferHandoverPackageRequest,
  grantTransferConsent as grantTransferConsentRequest,
  rejectTransfer as rejectTransferRequest,
  requestTransfer as requestTransferRequest,
  revokeTransferConsent as revokeTransferConsentRequest,
} from "./transferApi";

export const listHospitalBranches = async () => apiFetch("/api/branches");

export const createHospitalBranch = async (payload) =>
  apiFetch("/api/branches", {
    method: "POST",
    body: payload,
  });

export const listHospitalStaff = async (params = {}) => {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.q) qs.set("q", params.q);
  if (params.missingRegisteredPharmacy) qs.set("missingRegisteredPharmacy", "1");
  const query = qs.toString();
  return apiFetch(`/api/users${query ? `?${query}` : ""}`);
};

export const listManageableHospitals = async () =>
  apiFetch("/api/super-admin/hospitals?page=1&limit=1000");

export const registerHospitalStaff = async (payload) =>
  apiFetch("/api/hospital-admin/register-staff", {
    method: "POST",
    body: payload,
  });

export const deactivateHospitalStaff = async (staffId) =>
  apiFetch(`/api/users/${staffId}`, {
    method: "PATCH",
    body: { active: false },
  });

export const demoteHospitalStaffToPatient = async (staffId, reason = "Removed from hospital staffing roster") =>
  apiFetch(`/api/users/${staffId}/demote-to-patient`, {
    method: "PATCH",
    body: { reason },
  });

export const updateHospitalStaff = async (staffId, payload) =>
  apiFetch(`/api/users/${staffId}`, {
    method: "PATCH",
    body: payload,
  });

export const listHospitalStaffOptions = async () => apiFetch("/api/hospital-admin/staff");

export const listHospitalPharmacyOptions = async () => apiFetch("/api/pharmacy-network/pharmacies?limit=200");

export const listMachineConnectivityDevices = async () => apiFetch("/api/machine-connectivity/devices");

export const listMachineConnectivityOverview = async () => apiFetch("/api/machine-connectivity/overview");

export const listMachineConnectivityAudit = async (params = {}) => {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.machineId) qs.set("machineId", params.machineId);
  if (params.action && params.action !== "ALL") qs.set("action", params.action);
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  return apiFetch(`/api/machine-connectivity/audit${qs.toString() ? `?${qs.toString()}` : ""}`);
};

export const registerMachineDevice = async (payload) =>
  apiFetch("/api/machine-connectivity/devices", {
    method: "POST",
    body: payload,
  });

export const rotateMachineDeviceKey = async (deviceId) =>
  apiFetch(`/api/machine-connectivity/devices/${deviceId}/rotate-key`, {
    method: "POST",
  });

export const updateMachineDeviceStatus = async (deviceId, status) =>
  apiFetch(`/api/machine-connectivity/devices/${deviceId}`, {
    method: "PATCH",
    body: { status },
  });

export const testMachineHeartbeat = async (machineKey) =>
  fetchApi("/api/machine-connectivity/heartbeat", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "x-machine-key": machineKey,
    },
    body: {},
  });

export const testMachineLabIngest = async (payload) =>
  fetchApi("/api/machine-connectivity/lab-results", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "x-machine-key": payload.machineKey,
    },
    body: payload.body,
  });

export const testMachineHl7Parse = async (payload) =>
  apiFetch("/api/machine-connectivity/test/hl7-parse", {
    method: "POST",
    body: payload,
  });

export const testMachineDicomStub = async (payload) =>
  apiFetch("/api/machine-connectivity/test/dicom-stub", {
    method: "POST",
    body: payload,
  });

export const listMachineAlerts = async (params = {}) => {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.read !== undefined) qs.set("read", String(params.read));
  if (params.severity && params.severity !== "ALL") qs.set("severity", params.severity);
  return apiFetch(`/api/machine-connectivity/alerts${qs.toString() ? `?${qs.toString()}` : ""}`);
};

export const acknowledgeMachineAlert = async (alertId, reason = "") =>
  apiFetch(`/api/machine-connectivity/alerts/${alertId}/ack`, {
    method: "PATCH",
    body: { reason },
  });

export const escalateMachineAlert = async (alertId, reason = "") =>
  apiFetch(`/api/machine-connectivity/alerts/${alertId}/escalate`, {
    method: "POST",
    body: { reason },
  });

export const bulkAcknowledgeMachineAlerts = async (ids, reason = "") =>
  apiFetch("/api/machine-connectivity/alerts/ack-bulk", {
    method: "PATCH",
    body: { ids, reason },
  });

export const updateMachineAlertPolicy = async (payload) =>
  apiFetch("/api/machine-connectivity/alerts/policy", {
    method: "PUT",
    body: payload,
  });

export const getMachineAlertTimeline = async (alertId) =>
  apiFetch(`/api/machine-connectivity/alerts/${alertId}/timeline`);

export const downloadMachineAlertTimelineCsv = async (alertId) =>
  downloadApiFile(`/api/machine-connectivity/alerts/${alertId}/timeline.csv`, {
    filename: `machine-alert-${alertId}-timeline.csv`,
    headers: { Accept: "text/csv" },
  });

export const downloadMachineAlertTimelinePdf = async (alertId) =>
  downloadApiFile(`/api/machine-connectivity/alerts/${alertId}/timeline.pdf`, {
    filename: `machine-alert-${alertId}-timeline.pdf`,
    headers: { Accept: "application/pdf" },
  });

export const getMachineAlertEvidenceManifest = async (alertId) =>
  apiFetch(`/api/machine-connectivity/alerts/${alertId}/evidence-manifest`);

export const downloadMachineAlertEvidenceBundle = async (alertId) =>
  downloadApiFile(`/api/machine-connectivity/alerts/${alertId}/evidence-bundle`, {
    filename: `machine-alert-${alertId}-evidence-bundle.json`,
    headers: { Accept: "application/json" },
  });

export const verifyMachineAlertManifest = async (payload) =>
  apiFetch("/api/machine-connectivity/alerts/verify-manifest", {
    method: "POST",
    body: payload,
  });

export const listEscalations = async (params = {}) => {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.missingRequirement) qs.set("missingRequirement", params.missingRequirement);
  if (params.clinicianId) qs.set("clinicianId", params.clinicianId);
  if (params.ward) qs.set("ward", params.ward);
  if (params.sort) qs.set("sort", params.sort);
  if (params.q) qs.set("q", params.q);
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));
  return apiFetch(`/api/encounters/escalations?${qs.toString()}`);
};

export const bulkResolveEscalations = async (encounterIds = [], note = "") =>
  apiFetch("/api/encounters/escalations/bulk-resolve", {
    method: "POST",
    body: { encounterIds, note },
  });

export const bulkAssignEscalations = async (encounterIds = [], clinicianId) =>
  apiFetch("/api/encounters/escalations/bulk-assign", {
    method: "POST",
    body: { encounterIds, clinicianId },
  });

export const bulkReviewEscalations = async (encounterIds = []) =>
  apiFetch("/api/encounters/escalations/bulk-review", {
    method: "POST",
    body: { encounterIds },
  });

export const listHospitalCustomizationConfig = async () => apiFetch("/api/hospital-admin/config");

export const saveHospitalCustomization = async (payload) =>
  apiFetch("/api/hospital-admin/customization", {
    method: "PUT",
    body: payload,
  });

export const listCustomizationRequests = async () =>
  apiFetch("/api/hospital-admin/customization/requests");

export const createCustomizationRequest = async (payload) =>
  apiFetch("/api/hospital-admin/customization/requests", {
    method: "POST",
    body: payload,
  });

export const listStaffTransfers = async () => apiFetch("/api/staff-transfers?limit=100");

export const listStaffTransferUsers = async () => apiFetch("/api/users?limit=200");

export const listStaffTransferHospitals = async () => apiFetch("/api/hospitals?limit=1000");

export const createStaffTransfer = async (payload) =>
  apiFetch("/api/staff-transfers", {
    method: "POST",
    body: payload,
  });

export const updateStaffTransfer = async (transferId, action, body = {}) =>
  apiFetch(`/api/staff-transfers/${transferId}/${action}`, {
    method: "PATCH",
    body,
  });

export const listTransferCommandCenterOverview = async (params = {}) =>
  getTransferCommandCenterOverviewRequest(params);

export const listTransferHospitals = async ({ limit = 1000, marketplace = false } = {}) =>
  apiFetch(marketplace ? `/api/hospitals/marketplace?limit=${limit}` : `/api/hospitals?limit=${limit}`);

export const searchTransferPatients = async ({ q = "", limit = 100 } = {}) => {
  const endpoint = q ? `/api/patients?q=${encodeURIComponent(q)}&limit=${limit}` : `/api/patients?limit=${limit}`;
  return apiFetch(endpoint);
};

export const requestTransferCommand = async (payload) => requestTransferRequest(payload);

export const approveTransferCommand = async (transferId) => approveTransferRequest(transferId);

export const rejectTransferCommand = async (transferId, reason = "") => rejectTransferRequest(transferId, reason);

export const completeTransferCommand = async (transferId, body = {}) => completeTransferRequest(transferId, body);

export const grantTransferConsentCommand = async (transferId, body = {}) => grantTransferConsentRequest(transferId, body);

export const revokeTransferConsentCommand = async (transferId) => revokeTransferConsentRequest(transferId);

export const getTransferDetailCommand = async (transferId) => {
  const [handover, consent, audit] = await Promise.all([
    getTransferHandoverPackageRequest(transferId).catch(() => null),
    getTransferConsentRequest(transferId).catch(() => null),
    getTransferAuditTrailRequest(transferId).catch(() => null),
  ]);
  return { handover, consent, audit };
};

export default {
  listHospitalBranches,
  createHospitalBranch,
  listHospitalStaff,
  listManageableHospitals,
  registerHospitalStaff,
  deactivateHospitalStaff,
  demoteHospitalStaffToPatient,
  updateHospitalStaff,
  listHospitalStaffOptions,
  listMachineConnectivityDevices,
  listMachineConnectivityOverview,
  listMachineConnectivityAudit,
  registerMachineDevice,
  rotateMachineDeviceKey,
  updateMachineDeviceStatus,
  testMachineHeartbeat,
  testMachineLabIngest,
  testMachineHl7Parse,
  testMachineDicomStub,
  listMachineAlerts,
  acknowledgeMachineAlert,
  escalateMachineAlert,
  bulkAcknowledgeMachineAlerts,
  updateMachineAlertPolicy,
  getMachineAlertTimeline,
  downloadMachineAlertTimelineCsv,
  downloadMachineAlertTimelinePdf,
  getMachineAlertEvidenceManifest,
  downloadMachineAlertEvidenceBundle,
  verifyMachineAlertManifest,
  listHospitalCustomizationConfig,
  saveHospitalCustomization,
  listCustomizationRequests,
  createCustomizationRequest,
  listStaffTransfers,
  listStaffTransferUsers,
  listStaffTransferHospitals,
  createStaffTransfer,
  updateStaffTransfer,
  listTransferCommandCenterOverview,
  listTransferHospitals,
  searchTransferPatients,
  requestTransferCommand,
  approveTransferCommand,
  rejectTransferCommand,
  completeTransferCommand,
  grantTransferConsentCommand,
  revokeTransferConsentCommand,
  getTransferDetailCommand,
};
