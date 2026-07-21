import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  listHospitalBranches,
  createHospitalBranch,
  listHospitalStaff,
  listManageableHospitals,
  registerHospitalStaff,
  deactivateHospitalStaff,
  demoteHospitalStaffToPatient,
  updateHospitalStaff,
  listHospitalStaffOptions,
  listHospitalPharmacyOptions,
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
  searchTransferPatients as searchTransferPatientsApi,
  requestTransferCommand as requestTransferCommandApi,
  approveTransferCommand as approveTransferCommandApi,
  rejectTransferCommand as rejectTransferCommandApi,
  completeTransferCommand as completeTransferCommandApi,
  grantTransferConsentCommand as grantTransferConsentCommandApi,
  revokeTransferConsentCommand as revokeTransferConsentCommandApi,
  getTransferDetailCommand as getTransferDetailCommandApi,
} from "../services/hospitalAdminOperationsApi";

export function useHospitalAdminOperations() {
  const [branches, setBranches] = useState([]);
  const [branchLoading, setBranchLoading] = useState(false);
  const [branchMsg, setBranchMsg] = useState("");
  const [staff, setStaff] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffMsg, setStaffMsg] = useState("");
  const [hospitalOptions, setHospitalOptions] = useState([]);
  const [staffOptions, setStaffOptions] = useState([]);
  const [pharmacyOptions, setPharmacyOptions] = useState([]);
  const [staffPage, setStaffPage] = useState(1);
  const [staffTotal, setStaffTotal] = useState(0);
  const [staffQuery, setStaffQuery] = useState("");
  const [missingPharmacyOnly, setMissingPharmacyOnly] = useState(false);
  const [staffSaving, setStaffSaving] = useState(false);
  const [staffForm, setStaffForm] = useState({ name: "", email: "", password: "", department: "", role: "doctor" });
  const [devices, setDevices] = useState([]);
  const [overview, setOverview] = useState(null);
  const [auditRows, setAuditRows] = useState([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditFilters, setAuditFilters] = useState({ machineId: "", action: "ALL", from: "", to: "" });
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [deviceMsg, setDeviceMsg] = useState("");
  const [savingDevice, setSavingDevice] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [deviceForm, setDeviceForm] = useState({
    name: "",
    code: "",
    department: "",
    machineType: "LAB_ANALYZER",
    protocol: "HL7",
    active: true,
    capabilities: {
      ingestLabResults: true,
      ingestVitals: false,
      ingestImaging: false,
      pushAlerts: false,
    },
  });
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [testForm, setTestForm] = useState({
    machineKey: "",
    labOrderId: "",
    testName: "",
    patientId: "",
    externalResultId: "",
    resultJson: '{ "HB": 13.2, "WBC": 7.4 }',
  });
  const [testing, setTesting] = useState(false);
  const [hl7Input, setHl7Input] = useState("");
  const [hl7Output, setHl7Output] = useState(null);
  const [dicomForm, setDicomForm] = useState({
    studyUid: "",
    modality: "CT",
    patientId: "",
    accessionNumber: "",
    aet: "AFYALINK-PACS",
  });
  const [dicomOutput, setDicomOutput] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsMsg, setAlertsMsg] = useState("");
  const [alertsPage, setAlertsPage] = useState(1);
  const [alertsTotal, setAlertsTotal] = useState(0);
  const [alertFilters, setAlertFilters] = useState({ read: "ALL", severity: "ALL" });
  const [actionBusyId, setActionBusyId] = useState("");
  const [bulkReason, setBulkReason] = useState("");
  const [reasonById, setReasonById] = useState({});
  const [autoEscalation, setAutoEscalation] = useState({
    highAfterMinutes: 0,
    mediumAfterMinutes: 0,
    dedupCooldownMinutes: 0,
    l1Roles: [],
    l2Roles: [],
    requireReasonForHighSeverityActions: false,
  });
  const [policyDraft, setPolicyDraft] = useState({
    highAfterMinutes: 15,
    mediumAfterMinutes: 60,
    dedupCooldownMinutes: 10,
    l1RolesText: "HOSPITAL_ADMIN,DEVELOPER",
    l2RolesText: "SYSTEM_ADMIN,SUPER_ADMIN,DEVELOPER",
    onCallPrimaryUserIds: [],
    onCallSecondaryUserIds: [],
    requireReasonForHighSeverityActions: false,
  });
  const [timelineData, setTimelineData] = useState(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [manifestData, setManifestData] = useState(null);
  const [manifestLoading, setManifestLoading] = useState(false);
  const [manifestVerifyResult, setManifestVerifyResult] = useState(null);
  const [manifestVerifyLoading, setManifestVerifyLoading] = useState(false);
  const [customizationForm, setCustomizationForm] = useState({
    enabled: true,
    branding: { appName: "", tagline: "", logo: "", appIcon: "", favicon: "", loginBackground: "", homeBackground: "" },
    theme: { primaryColor: "", accentColor: "", sidebarStyle: "DEFAULT", topbarStyle: "DEFAULT" },
    modules: { showAI: true, showReports: true, showAnalytics: true },
    clinical: { closeoutPolicy: { enabled: false, requireDiagnosisBeforeClose: null, requireBillingHandoffWhenPaymentsEnabled: null, requirePrescriptionWhenPharmacyEnabled: null } },
  });
  const [customizationLoading, setCustomizationLoading] = useState(false);
  const [customizationMsg, setCustomizationMsg] = useState("");
  const [customizationRequests, setCustomizationRequests] = useState([]);
  const [requestForm, setRequestForm] = useState({ scope: "HOSPITAL", country: "", title: "", requirements: "", requestedModules: "", exclusiveDeployment: true, desiredGoLiveDate: "" });
  const [requestSaving, setRequestSaving] = useState(false);
  const [staffTransfers, setStaffTransfers] = useState([]);
  const [staffTransferUsers, setStaffTransferUsers] = useState([]);
  const [staffTransferHospitals, setStaffTransferHospitals] = useState([]);
  const [transferForm, setTransferForm] = useState({ staffUserId: "", toHospitalId: "", transferLetterRef: "", note: "" });
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferMsg, setTransferMsg] = useState("");

  const loadBranches = useCallback(async () => {
    setBranchLoading(true);
    setBranchMsg("");
    try {
      const data = await listHospitalBranches();
      setBranches(Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : Array.isArray(data?.data) ? data.data : []);
    } catch (err) {
      setBranchMsg(err?.message || "Failed to load branches");
      setBranches([]);
    } finally {
      setBranchLoading(false);
    }
  }, []);

  const createBranch = useCallback(async (payload) => {
    try {
      await createHospitalBranch(payload);
      await loadBranches();
      setBranchMsg("Branch added under the verified parent hospital.");
    } catch (err) {
      setBranchMsg(err?.message || "Failed to create branch");
    }
  }, [loadBranches]);

  const loadStaff = useCallback(async (pageOverride = staffPage, queryOverride = staffQuery, missingPharmacyOverride = missingPharmacyOnly) => {
    setStaffLoading(true);
    setStaffMsg("");
    try {
      const res = await listHospitalStaff({ page: pageOverride, limit: 20, q: queryOverride, missingRegisteredPharmacy: missingPharmacyOverride ? 1 : 0 });
      const items = Array.isArray(res) ? res : Array.isArray(res?.items) ? res.items : [];
      setStaff(items);
      setStaffTotal(Number(res?.total || items.length));
    } catch (err) {
      setStaffMsg(err?.message || "Failed to load staff");
      setStaff([]);
      setStaffTotal(0);
    } finally {
      setStaffLoading(false);
    }
  }, [missingPharmacyOnly, staffPage, staffQuery]);

  useEffect(() => { void loadStaff(); }, [loadStaff]);

  const loadHospitalOptions = useCallback(async () => {
    try {
      const res = await listManageableHospitals();
      const items = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
      setHospitalOptions(items);
    } catch {
      setHospitalOptions([]);
    }
  }, []);

  useEffect(() => { void loadHospitalOptions(); }, [loadHospitalOptions]);

  const loadStaffOptions = useCallback(async () => {
    try {
      const rows = await listHospitalStaffOptions();
      setStaffOptions(Array.isArray(rows) ? rows : []);
    } catch {
      setStaffOptions([]);
    }
  }, []);

  const loadPharmacyOptions = useCallback(async () => {
    try {
      const rows = await listHospitalPharmacyOptions();
      setPharmacyOptions(Array.isArray(rows?.items) ? rows.items : Array.isArray(rows) ? rows : []);
    } catch {
      setPharmacyOptions([]);
    }
  }, []);

  useEffect(() => { void loadStaffOptions(); }, [loadStaffOptions]);
  useEffect(() => { void loadPharmacyOptions(); }, [loadPharmacyOptions]);

  const registerStaff = useCallback(async (payload) => {
    setStaffSaving(true);
    setStaffMsg("");
    try {
      const res = await registerHospitalStaff(payload);
      setStaffForm({ name: "", email: "", password: "", department: "", role: "doctor" });
      setStaffMsg(res?.msg || "Staff registered");
      await loadStaff();
    } catch (err) {
      setStaffMsg(err?.message || "Failed to register staff");
    } finally {
      setStaffSaving(false);
    }
  }, [loadStaff]);

  const deactivateStaff = useCallback(async (staffId) => {
    try {
      setStaffMsg("");
      await deactivateHospitalStaff(staffId);
      await loadStaff();
    } catch (err) {
      setStaffMsg(err?.message || "Failed to deactivate staff account");
    }
  }, [loadStaff]);

  const demoteStaffToPatient = useCallback(async (staffId) => {
    try {
      setStaffMsg("");
      await demoteHospitalStaffToPatient(staffId);
      await loadStaff();
    } catch (err) {
      setStaffMsg(err?.message || "Failed to demote user to patient");
    }
  }, [loadStaff]);

  const updateStaffRole = useCallback(async (staffId, payload) => {
    try {
      setStaffMsg("");
      await updateHospitalStaff(staffId, payload);
      await loadStaff();
    } catch (err) {
      setStaffMsg(err?.message || "Failed to update staff role");
    }
  }, [loadStaff]);

  const loadDevices = useCallback(async () => {
    setDeviceLoading(true);
    setDeviceMsg("");
    try {
      const rows = await listMachineConnectivityDevices();
      const items = Array.isArray(rows?.items) ? rows.items : [];
      setDevices(items);
      if (!selectedDeviceId && items.length) setSelectedDeviceId(items[0]._id);
    } catch (err) {
      setDeviceMsg(err?.message || "Failed to load machine devices");
      setDevices([]);
    } finally {
      setDeviceLoading(false);
    }
  }, [selectedDeviceId]);

  const loadOverview = useCallback(async () => {
    try {
      const data = await listMachineConnectivityOverview();
      setOverview(data || null);
    } catch {
      setOverview(null);
    }
  }, []);

  const loadAudit = useCallback(async (page = auditPage) => {
    try {
      const data = await listMachineConnectivityAudit({ page, limit: 20, ...auditFilters });
      setAuditRows(Array.isArray(data?.items) ? data.items : []);
      setAuditTotal(Number(data?.total || 0));
      setAuditPage(Number(data?.page || page));
    } catch {
      setAuditRows([]);
      setAuditTotal(0);
    }
  }, [auditFilters, auditPage]);

  useEffect(() => {
    void loadDevices();
    void loadOverview();
    void loadAudit(1);
    const t = setInterval(() => { void loadDevices(); }, 30000);
    return () => clearInterval(t);
  }, [loadDevices, loadOverview, loadAudit]);

  useEffect(() => { void loadAudit(1); }, [auditFilters.machineId, auditFilters.action, auditFilters.from, auditFilters.to, loadAudit]);

  const registerDevice = useCallback(async (payloadOrEvent) => {
    if (payloadOrEvent?.preventDefault) payloadOrEvent.preventDefault();
    setSavingDevice(true);
    setDeviceMsg("");
    setNewKey("");
    try {
      const payload = payloadOrEvent?.preventDefault
        ? { ...deviceForm, code: String(deviceForm.code || "").trim().toUpperCase() }
        : payloadOrEvent;
      const data = await registerMachineDevice(payload);
      setNewKey(data?.machineKey || "");
      setDeviceForm({
        name: "",
        code: "",
        department: "",
        machineType: "LAB_ANALYZER",
        protocol: "HL7",
        active: true,
        capabilities: { ingestLabResults: true, ingestVitals: false, ingestImaging: false, pushAlerts: false },
      });
      await loadDevices();
      setDeviceMsg("Machine registered successfully.");
    } catch (err) {
      setDeviceMsg(err?.message || "Failed to register machine");
    } finally {
      setSavingDevice(false);
    }
  }, [deviceForm, loadDevices]);

  const rotateKey = useCallback(async (deviceId) => {
    setSavingDevice(true);
    setDeviceMsg("");
    setNewKey("");
    try {
      const data = await rotateMachineDeviceKey(deviceId);
      setNewKey(data?.machineKey || "");
      setDeviceMsg("Machine key rotated. Store the new key securely.");
    } catch (err) {
      setDeviceMsg(err?.message || "Failed to rotate machine key");
    } finally {
      setSavingDevice(false);
    }
  }, []);

  const updateStatus = useCallback(async (deviceId, status) => {
    try {
      await updateMachineDeviceStatus(deviceId, status);
      await loadDevices();
    } catch (err) {
      setDeviceMsg(err?.message || "Failed to update machine status");
    }
  }, [loadDevices]);

  const machinePost = useCallback(async (path, machineKey, body = {}) => {
    return testMachineHeartbeat(machineKey);
  }, []);

  const testHeartbeat = useCallback(async () => {
    if (!testForm.machineKey.trim()) {
      setDeviceMsg("Enter machine key first.");
      return;
    }
    setTesting(true);
    setDeviceMsg("");
    try {
      const data = await testMachineHeartbeat(testForm.machineKey.trim());
      setDeviceMsg(`Heartbeat OK: ${data?.status || "ONLINE"} @ ${data?.serverTime || "-"}`);
      await loadDevices();
    } catch (err) {
      setDeviceMsg(err?.message || "Heartbeat test failed");
    } finally {
      setTesting(false);
    }
  }, [loadDevices, testForm.machineKey]);

  const testLabIngest = useCallback(async (event) => {
    event.preventDefault();
    if (!testForm.machineKey.trim() || !testForm.labOrderId.trim()) {
      setDeviceMsg("Machine key and Lab Order ID are required.");
      return;
    }
    const parsed = (() => { try { return { ok: true, value: JSON.parse(testForm.resultJson) }; } catch { return { ok: false, value: null }; } })();
    if (!parsed.ok) {
      setDeviceMsg("Result JSON is invalid.");
      return;
    }
    setTesting(true);
    setDeviceMsg("");
    try {
      const data = await testMachineLabIngest({
        machineKey: testForm.machineKey.trim(),
        body: {
          labOrderId: testForm.labOrderId.trim(),
          testName: testForm.testName.trim() || undefined,
          patientId: testForm.patientId.trim() || undefined,
          externalResultId: testForm.externalResultId.trim() || undefined,
          resultStatus: "completed",
          result: parsed.value,
        },
      });
      setDeviceMsg(`Lab ingestion OK: order ${data?.labOrderId || "-"} marked ${data?.status || "Completed"}`);
      await loadDevices();
    } catch (err) {
      setDeviceMsg(err?.message || "Lab ingestion test failed");
    } finally {
      setTesting(false);
    }
  }, [loadDevices, testForm.labOrderId, testForm.machineKey, testForm.patientId, testForm.resultJson, testForm.testName]);

  const runHl7ParseTest = useCallback(async () => {
    setTesting(true);
    setDeviceMsg("");
    try {
      const data = await testMachineHl7Parse({ hl7: hl7Input });
      setHl7Output(data);
      setDeviceMsg("HL7 parse test succeeded.");
    } catch (err) {
      setDeviceMsg(err?.message || "HL7 parse test failed");
      setHl7Output(null);
    } finally {
      setTesting(false);
    }
  }, [hl7Input]);

  const runDicomStubTest = useCallback(async () => {
    setTesting(true);
    setDeviceMsg("");
    try {
      const data = await testMachineDicomStub(dicomForm);
      setDicomOutput(data);
      setDeviceMsg("DICOM stub test succeeded.");
    } catch (err) {
      setDeviceMsg(err?.message || "DICOM stub test failed");
      setDicomOutput(null);
    } finally {
      setTesting(false);
    }
  }, [dicomForm]);

  const loadAlerts = useCallback(async (nextPage = alertsPage) => {
    setAlertsLoading(true);
    setAlertsMsg("");
    try {
      const data = await listMachineAlerts({ page: nextPage, limit: 20, read: alertFilters.read === "ALL" ? undefined : alertFilters.read === "READ" ? true : false, severity: alertFilters.severity });
      setAlerts(Array.isArray(data?.items) ? data.items : []);
      setAlertsTotal(Number(data?.total || 0));
      setAlertsPage(Number(data?.page || nextPage));
      const p = data?.autoEscalation || { highAfterMinutes: 0, mediumAfterMinutes: 0 };
      setAutoEscalation(p);
      setPolicyDraft({ highAfterMinutes: Number(p.highAfterMinutes || 0), mediumAfterMinutes: Number(p.mediumAfterMinutes || 0), dedupCooldownMinutes: Number(p.dedupCooldownMinutes || 0), l1RolesText: Array.isArray(p.l1Roles) ? p.l1Roles.join(",") : "HOSPITAL_ADMIN,DEVELOPER", l2RolesText: Array.isArray(p.l2Roles) ? p.l2Roles.join(",") : "SYSTEM_ADMIN,SUPER_ADMIN,DEVELOPER", onCallPrimaryUserIds: Array.isArray(p.onCallPrimaryUserIds) ? p.onCallPrimaryUserIds.map(String) : [], onCallSecondaryUserIds: Array.isArray(p.onCallSecondaryUserIds) ? p.onCallSecondaryUserIds.map(String) : [], requireReasonForHighSeverityActions: Boolean(p.requireReasonForHighSeverityActions) });
    } catch (err) {
      setAlertsMsg(err?.message || "Failed to load machine alerts");
      setAlerts([]);
      setAlertsTotal(0);
    } finally {
      setAlertsLoading(false);
    }
  }, [alertFilters.read, alertFilters.severity, alertsPage]);

  useEffect(() => { void loadAlerts(1); }, [alertFilters.read, alertFilters.severity, loadAlerts]);

  const acknowledgeAlert = useCallback(async (alertId) => {
    setActionBusyId(alertId);
    setAlertsMsg("");
    try {
      const row = alerts.find((x) => x._id === alertId);
      const reason = String(reasonById[alertId] || "").trim();
      if (autoEscalation.requireReasonForHighSeverityActions && String(row?.severity || "").toUpperCase() === "HIGH" && !reason) {
        setAlertsMsg("Reason is required to acknowledge high severity alerts.");
        return;
      }
      await acknowledgeMachineAlert(alertId, reason);
      setAlerts((prev) => prev.map((x) => (x._id === alertId ? { ...x, read: true } : x)));
      setReasonById((prev) => ({ ...prev, [alertId]: "" }));
    } catch (err) {
      setAlertsMsg(err?.message || "Failed to acknowledge alert");
    } finally {
      setActionBusyId("");
    }
  }, [alerts, autoEscalation.requireReasonForHighSeverityActions, reasonById]);

  const escalateAlert = useCallback(async (alertId) => {
    setActionBusyId(alertId);
    setAlertsMsg("");
    try {
      const row = alerts.find((x) => x._id === alertId);
      const reason = String(reasonById[alertId] || "").trim();
      if (autoEscalation.requireReasonForHighSeverityActions && String(row?.severity || "").toUpperCase() === "HIGH" && !reason) {
        setAlertsMsg("Reason is required to escalate high severity alerts.");
        return;
      }
      const data = await escalateMachineAlert(alertId, reason);
      setAlerts((prev) => prev.map((x) => (x._id === alertId ? { ...x, meta: { ...(x.meta || {}), escalated: true } } : x)));
      setAlertsMsg(`Alert escalated to ${Number(data?.recipients || 0)} recipients.`);
      setReasonById((prev) => ({ ...prev, [alertId]: "" }));
    } catch (err) {
      setAlertsMsg(err?.message || "Failed to escalate alert");
    } finally {
      setActionBusyId("");
    }
  }, [alerts, autoEscalation.requireReasonForHighSeverityActions, reasonById]);

  const acknowledgeVisibleAlerts = useCallback(async () => {
    setActionBusyId("bulk");
    setAlertsMsg("");
    try {
      const ids = alerts.filter((x) => !x.read).map((x) => x._id);
      if (!ids.length) {
        setAlertsMsg("No unread alerts on this page.");
        return;
      }
      const hasHighUnread = alerts.some((x) => !x.read && String(x.severity || "").toUpperCase() === "HIGH");
      const reason = String(bulkReason || "").trim();
      if (autoEscalation.requireReasonForHighSeverityActions && hasHighUnread && !reason) {
        setAlertsMsg("Reason is required for bulk acknowledgement when high severity alerts are included.");
        return;
      }
      const data = await bulkAcknowledgeMachineAlerts(ids, reason);
      setAlerts((prev) => prev.map((x) => ({ ...x, read: true })));
      setAlertsMsg(`Acknowledged ${Number(data?.modified || 0)} alert(s).`);
      setBulkReason("");
    } catch (err) {
      setAlertsMsg(err?.message || "Failed to acknowledge visible alerts");
    } finally {
      setActionBusyId("");
    }
  }, [alerts, autoEscalation.requireReasonForHighSeverityActions, bulkReason]);

  const savePolicy = useCallback(async (event) => {
    event.preventDefault();
    setActionBusyId("policy");
    setAlertsMsg("");
    try {
      const payload = { highAfterMinutes: Number(policyDraft.highAfterMinutes), mediumAfterMinutes: Number(policyDraft.mediumAfterMinutes), dedupCooldownMinutes: Number(policyDraft.dedupCooldownMinutes), l1Roles: String(policyDraft.l1RolesText || "").split(",").map((x) => x.trim().toUpperCase()).filter(Boolean), l2Roles: String(policyDraft.l2RolesText || "").split(",").map((x) => x.trim().toUpperCase()).filter(Boolean), onCallPrimaryUserIds: policyDraft.onCallPrimaryUserIds || [], onCallSecondaryUserIds: policyDraft.onCallSecondaryUserIds || [], requireReasonForHighSeverityActions: Boolean(policyDraft.requireReasonForHighSeverityActions) };
      const data = await updateMachineAlertPolicy(payload);
      const p = data?.policy || payload;
      setAutoEscalation(p);
      setPolicyDraft({ highAfterMinutes: Number(p.highAfterMinutes || 0), mediumAfterMinutes: Number(p.mediumAfterMinutes || 0), dedupCooldownMinutes: Number(p.dedupCooldownMinutes || 0), l1RolesText: Array.isArray(p.l1Roles) ? p.l1Roles.join(",") : "", l2RolesText: Array.isArray(p.l2Roles) ? p.l2Roles.join(",") : "", onCallPrimaryUserIds: Array.isArray(p.onCallPrimaryUserIds) ? p.onCallPrimaryUserIds.map(String) : [], onCallSecondaryUserIds: Array.isArray(p.onCallSecondaryUserIds) ? p.onCallSecondaryUserIds.map(String) : [], requireReasonForHighSeverityActions: Boolean(p.requireReasonForHighSeverityActions) });
      setAlertsMsg("Escalation policy updated.");
    } catch (err) {
      setAlertsMsg(err?.message || "Failed to update escalation policy");
    } finally {
      setActionBusyId("");
    }
  }, [policyDraft]);

  const openTimeline = useCallback(async (alertId) => {
    setTimelineLoading(true);
    setAlertsMsg("");
    try {
      const data = await getMachineAlertTimeline(alertId);
      setTimelineData(data || null);
    } catch (err) {
      setAlertsMsg(err?.message || "Failed to load alert timeline");
      setTimelineData(null);
    } finally {
      setTimelineLoading(false);
    }
  }, []);

  const downloadTimelineCsv = useCallback(async (alertId) => {
    try {
      await downloadMachineAlertTimelineCsv(alertId);
    } catch (err) {
      setAlertsMsg(err?.message || "Failed to export timeline CSV");
    }
  }, []);

  const downloadTimelinePdf = useCallback(async (alertId) => {
    try {
      await downloadMachineAlertTimelinePdf(alertId);
    } catch (err) {
      setAlertsMsg(err?.message || "Failed to export timeline PDF");
    }
  }, []);

  const loadEvidenceManifest = useCallback(async (alertId) => {
    setManifestLoading(true);
    setManifestVerifyResult(null);
    setAlertsMsg("");
    try {
      const data = await getMachineAlertEvidenceManifest(alertId);
      setManifestData(data || null);
    } catch (err) {
      setAlertsMsg(err?.message || "Failed to load evidence manifest");
      setManifestData(null);
    } finally {
      setManifestLoading(false);
    }
  }, []);

  const downloadEvidenceBundle = useCallback(async (alertId) => {
    try {
      await downloadMachineAlertEvidenceBundle(alertId);
    } catch (err) {
      setAlertsMsg(err?.message || "Failed to download evidence bundle");
    }
  }, []);

  const verifyManifest = useCallback(async () => {
    setManifestVerifyLoading(true);
    setManifestVerifyResult(null);
    setAlertsMsg("");
    try {
      const data = await verifyMachineAlertManifest(manifestData?.payload ? { payload: manifestData.payload, signature: manifestData.signature } : { payload: null, signature: null });
      setManifestVerifyResult(data || null);
    } catch (err) {
      setAlertsMsg(err?.message || "Failed to verify evidence manifest");
    } finally {
      setManifestVerifyLoading(false);
    }
  }, [manifestData?.payload, manifestData?.signature]);

  const loadCustomization = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setCustomizationLoading(true);
    try {
      const data = await listHospitalCustomizationConfig();
      setCustomizationForm({
        enabled: true,
        branding: { appName: "", tagline: "", logo: "", appIcon: "", favicon: "", loginBackground: "", homeBackground: "" },
        theme: { primaryColor: "", accentColor: "", sidebarStyle: "DEFAULT", topbarStyle: "DEFAULT" },
        modules: { showAI: true, showReports: true, showAnalytics: true },
        clinical: { closeoutPolicy: { enabled: false, requireDiagnosisBeforeClose: null, requireBillingHandoffWhenPaymentsEnabled: null, requirePrescriptionWhenPharmacyEnabled: null } },
        ...data?.customization,
      });
      const reqData = await listCustomizationRequests();
      setCustomizationRequests(reqData?.items || []);
    } catch {
      setCustomizationForm({ enabled: true, branding: { appName: "", tagline: "", logo: "", appIcon: "", favicon: "", loginBackground: "", homeBackground: "" }, theme: { primaryColor: "", accentColor: "", sidebarStyle: "DEFAULT", topbarStyle: "DEFAULT" }, modules: { showAI: true, showReports: true, showAnalytics: true }, clinical: { closeoutPolicy: { enabled: false, requireDiagnosisBeforeClose: null, requireBillingHandoffWhenPaymentsEnabled: null, requirePrescriptionWhenPharmacyEnabled: null } } });
      setCustomizationRequests([]);
    } finally {
      if (!silent) setCustomizationLoading(false);
    }
  }, []);

  useEffect(() => { void loadCustomization(); }, [loadCustomization]);

  const persistCustomization = useCallback(async (customizationPatch, successMsg = "Hospital customization saved successfully.") => {
    setCustomizationLoading(true);
    setCustomizationMsg("");
    try {
      await saveHospitalCustomization({ customization: customizationPatch });
      setCustomizationMsg(successMsg);
      await loadCustomization({ silent: true });
    } catch (err) {
      setCustomizationMsg(err?.message || "Failed to save customization.");
    } finally {
      setCustomizationLoading(false);
    }
  }, [loadCustomization]);

  const submitCustomizationRequest = useCallback(async (payload) => {
    setRequestSaving(true);
    setCustomizationMsg("");
    try {
      await createCustomizationRequest(payload);
      setRequestForm({ scope: "HOSPITAL", country: "", title: "", requirements: "", requestedModules: "", exclusiveDeployment: true, desiredGoLiveDate: "" });
      await loadCustomization({ silent: true });
      setCustomizationMsg("Customization request submitted.");
    } catch (err) {
      setCustomizationMsg(err?.message || "Failed to submit customization request");
    } finally {
      setRequestSaving(false);
    }
  }, [loadCustomization]);

  const loadTransfers = useCallback(async () => {
    setTransferLoading(true);
    setTransferMsg("");
    try {
      const [transfers, users, hospitals] = await Promise.all([listStaffTransfers(), listStaffTransferUsers(), listStaffTransferHospitals().catch(() => ({ items: [] }))]);
      setStaffTransfers(Array.isArray(transfers?.items) ? transfers.items : []);
      setStaffTransferUsers(Array.isArray(users?.items) ? users.items : Array.isArray(users) ? users : []);
      setStaffTransferHospitals(Array.isArray(hospitals?.items) ? hospitals.items : Array.isArray(hospitals) ? hospitals : []);
    } catch (err) {
      setTransferMsg(err?.message || "Failed to load transfer data");
    } finally {
      setTransferLoading(false);
    }
  }, []);

  useEffect(() => { void loadTransfers(); }, [loadTransfers]);

  const loadTransferOverview = useCallback(async ({ status = "", limit = 50 } = {}) => {
    return listTransferCommandCenterOverview({ status, limit });
  }, []);

  const loadTransferHospitals = useCallback(async ({ marketplace = false, limit = 1000 } = {}) => {
    const data = await listTransferHospitals({ marketplace, limit });
    return Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
  }, []);

  const searchTransferPatients = useCallback(async ({ q = "", limit = 100 } = {}) => {
    const data = await searchTransferPatientsApi({ q, limit });
    return Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
  }, []);

  const requestTransferCommand = useCallback(async (payload) => requestTransferCommandApi(payload), []);

  const approveTransferCommand = useCallback(async (transferId) => approveTransferCommandApi(transferId), []);

  const rejectTransferCommand = useCallback(async (transferId, reason = "") => rejectTransferCommandApi(transferId, reason), []);

  const completeTransferCommand = useCallback(async (transferId, body = {}) => completeTransferCommandApi(transferId, body), []);

  const grantTransferConsentCommand = useCallback(async (transferId, body = {}) => grantTransferConsentCommandApi(transferId, body), []);

  const revokeTransferConsentCommand = useCallback(async (transferId) => revokeTransferConsentCommandApi(transferId), []);

  const getTransferDetail = useCallback(async (transferId) => getTransferDetailCommandApi(transferId), []);

  const createTransfer = useCallback(async (event) => {
    event.preventDefault();
    setTransferMsg("");
    try {
      await createStaffTransfer(transferForm);
      setTransferForm({ staffUserId: "", toHospitalId: "", transferLetterRef: "", note: "" });
      setTransferMsg("Transfer request created");
      await loadTransfers();
    } catch (err) {
      setTransferMsg(err?.message || "Failed to create transfer request");
    }
  }, [loadTransfers, transferForm]);

  const actionTransfer = useCallback(async (transferId, action, body = {}) => {
    try {
      await updateStaffTransfer(transferId, action, body);
      await loadTransfers();
    } catch (err) {
      setTransferMsg(err?.message || `Failed to ${action}`);
    }
  }, [loadTransfers]);

  return {
    branches,
    branchLoading,
    branchMsg,
    loadBranches,
    createBranch,
    staff,
    staffLoading,
    staffMsg,
    staffPage,
    setStaffPage,
    staffTotal,
    staffQuery,
    setStaffQuery,
    missingPharmacyOnly,
    setMissingPharmacyOnly,
    loadStaff,
    hospitalOptions,
    staffOptions,
    pharmacyOptions,
    staffSaving,
    staffForm,
    setStaffForm,
    registerStaff,
    deactivateStaff,
    demoteStaffToPatient,
    updateStaffRole,
    devices,
    overview,
    auditRows,
    auditTotal,
    auditPage,
    setAuditPage,
    auditFilters,
    setAuditFilters,
    deviceLoading,
    deviceMsg,
    savingDevice,
    newKey,
    deviceForm,
    setDeviceForm,
    selectedDeviceId,
    setSelectedDeviceId,
    testForm,
    setTestForm,
    testing,
    hl7Input,
    setHl7Input,
    hl7Output,
    setHl7Output,
    dicomForm,
    setDicomForm,
    dicomOutput,
    setDicomOutput,
    testHeartbeat,
    testLabIngest,
    runHl7ParseTest,
    runDicomStubTest,
    registerDevice,
    rotateKey,
    updateStatus,
    alerts,
    alertsLoading,
    alertsMsg,
    setAlertsMsg,
    alertsPage,
    setAlertsPage,
    alertsTotal,
    alertFilters,
    setAlertFilters,
    actionBusyId,
    setActionBusyId,
    bulkReason,
    setBulkReason,
    reasonById,
    setReasonById,
    autoEscalation,
    policyDraft,
    setPolicyDraft,
    acknowledgeAlert,
    escalateAlert,
    acknowledgeVisibleAlerts,
    savePolicy,
    openTimeline,
    downloadTimelineCsv,
    downloadTimelinePdf,
    loadEvidenceManifest,
    downloadEvidenceBundle,
    verifyManifest,
    timelineData,
    timelineLoading,
    manifestData,
    manifestLoading,
    manifestVerifyResult,
    manifestVerifyLoading,
    customizationForm,
    setCustomizationForm,
    customizationLoading,
    customizationMsg,
    customizationRequests,
    requestForm,
    setRequestForm,
    requestSaving,
    submitCustomizationRequest,
    persistCustomization,
    staffTransfers,
    staffTransferUsers,
    staffTransferHospitals,
    transferForm,
    setTransferForm,
    transferLoading,
    transferMsg,
    createTransfer,
    actionTransfer,
    loadTransferOverview,
    loadTransferHospitals,
    searchTransferPatients,
    requestTransferCommand,
    approveTransferCommand,
    rejectTransferCommand,
    completeTransferCommand,
    grantTransferConsentCommand,
    revokeTransferConsentCommand,
    getTransferDetail,
  };
}

export default useHospitalAdminOperations;
