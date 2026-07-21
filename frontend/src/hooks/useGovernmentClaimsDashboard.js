import { useCallback, useEffect, useMemo, useState } from "react";
import claimsService from "../services/claims";

const emptyOverview = {
  summary: {
    totalClaims: 0,
    approved: 0,
    rejected: 0,
    pending: 0,
    reviewRequired: 0,
    paid: 0,
    fraudOpen: 0,
    fraudHigh: 0,
    hospitalsTotal: 0,
    patientsTotal: 0,
    patientsVerified: 0,
    patientsUnverified: 0,
    compliantHospitals: 0,
    nonCompliantHospitals: 0,
    totalAmount: 0,
    approvedAmount: 0,
    rejectedAmount: 0,
    pendingAmount: 0,
    reviewAmount: 0,
  },
  trends: [],
  riskMap: [],
  hospitalMonitoring: [],
  providerSummary: [],
  currencySummary: [],
  proceduresSummary: [],
  fraudSeverity: {},
  fraudSignals: [],
  suspiciousClaims: [],
  funds: [],
  notifications: [],
};

export function useGovernmentClaimsDashboard(filters = {}, alertsFilters = {}) {
  const [overview, setOverview] = useState(emptyOverview);
  const [claims, setClaims] = useState([]);
  const [fraudAlerts, setFraudAlerts] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [enforcements, setEnforcements] = useState([]);
  const [healthFunds, setHealthFunds] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [missingApi, setMissingApi] = useState(false);
  const [apiStatus, setApiStatus] = useState({ state: "unknown", detail: "", lastChecked: null, lastSuccessAt: null });
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditClaim, setAuditClaim] = useState(null);
  const [auditTrail, setAuditTrail] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [patientQuery, setPatientQuery] = useState("");
  const [patientHistory, setPatientHistory] = useState(null);
  const [patientLoading, setPatientLoading] = useState(false);
  const [inspectionForm, setInspectionForm] = useState({ hospitalId: "", scheduledAt: "", type: "ROUTINE", notes: "" });
  const [enforcementForm, setEnforcementForm] = useState({ hospitalId: "", actionType: "WARNING", amount: "", currency: "KES", notes: "" });
  const [fundForm, setFundForm] = useState({ code: "", name: "", country: "", currency: "KES", status: "ACTIVE", apiStatus: "UNKNOWN" });

  const loadOverview = useCallback(async () => {
    try {
      const res = await claimsService.getGovernmentOverview?.(filters);
      setOverview({ ...emptyOverview, ...(res || {}) });
      return res;
    } catch (err) {
      if (err?.status === 404) {
        setMissingApi(true);
        setOverview(emptyOverview);
        return null;
      }
      throw err;
    }
  }, [filters]);

  const loadClaims = useCallback(async (overrides = {}) => {
    try {
      const res = await claimsService.listGovernmentClaims?.({ ...filters, ...overrides });
      setClaims(Array.isArray(res?.items) ? res.items : []);
      return res;
    } catch (err) {
      if (err?.status === 404) {
        setMissingApi(true);
        setClaims([]);
        return null;
      }
      throw err;
    }
  }, [filters]);

  const loadFraudAlerts = useCallback(async (overrides = {}) => {
    try {
      const res = await claimsService.listGovernmentAlerts?.({ ...alertsFilters, ...overrides });
      setFraudAlerts(Array.isArray(res?.items) ? res.items : []);
      return res;
    } catch (err) {
      if (err?.status === 404) {
        setMissingApi(true);
        setFraudAlerts([]);
        return null;
      }
      throw err;
    }
  }, [alertsFilters]);

  const loadHospitals = useCallback(async () => {
    try {
      const res = await claimsService.listGovernmentHospitals?.(filters);
      setHospitals(Array.isArray(res?.items) ? res.items : []);
      return res;
    } catch (err) {
      if (err?.status === 404) {
        setMissingApi(true);
        setHospitals([]);
        return null;
      }
      throw err;
    }
  }, [filters]);

  const loadInspections = useCallback(async () => {
    try {
      const res = await claimsService.listGovernmentInspections?.(filters);
      setInspections(Array.isArray(res?.items) ? res.items : []);
      return res;
    } catch (err) {
      if (err?.status === 404) {
        setMissingApi(true);
        setInspections([]);
        return null;
      }
      throw err;
    }
  }, [filters]);

  const loadEnforcements = useCallback(async () => {
    try {
      const res = await claimsService.listGovernmentEnforcements?.(filters);
      setEnforcements(Array.isArray(res?.items) ? res.items : []);
      return res;
    } catch (err) {
      if (err?.status === 404) {
        setMissingApi(true);
        setEnforcements([]);
        return null;
      }
      throw err;
    }
  }, [filters]);

  const loadHealthFunds = useCallback(async () => {
    try {
      const res = await claimsService.listGovernmentHealthFunds?.(filters);
      setHealthFunds(Array.isArray(res?.items) ? res.items : []);
      return res;
    } catch (err) {
      if (err?.status === 404) {
        setMissingApi(true);
        setHealthFunds([]);
        return null;
      }
      throw err;
    }
  }, [filters]);

  const loadAuditLogs = useCallback(async () => {
    try {
      const res = await claimsService.getGovernmentAuditLogs?.();
      setAuditLogs(Array.isArray(res?.items) ? res.items : []);
      return res;
    } catch (err) {
      if (err?.status === 404) {
        setMissingApi(true);
        setAuditLogs([]);
        return null;
      }
      throw err;
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await claimsService.getGovernmentNotifications?.();
      setNotifications(Array.isArray(res?.items) ? res.items : []);
      return res;
    } catch (err) {
      if (err?.status === 404) {
        setMissingApi(true);
        setNotifications([]);
        return null;
      }
      throw err;
    }
  }, []);

  const loadAll = useCallback(async (options = {}) => {
    const silent = Boolean(options.silent);
    if (!silent) setLoading(true);
    setMsg("");
    setMissingApi(false);
    setApiStatus((prev) => ({ ...prev, state: "checking" }));
    try {
      const results = await Promise.allSettled([
        loadOverview(),
        loadClaims(),
        loadFraudAlerts(),
        loadHospitals(),
        loadInspections(),
        loadEnforcements(),
        loadHealthFunds(),
        loadAuditLogs(),
        loadNotifications(),
      ]);
      const failures = results.filter((row) => row.status === "rejected");
      if (failures.length === 0) {
        const now = new Date().toISOString();
        setApiStatus({ state: "ok", detail: "All government endpoints healthy.", lastChecked: now, lastSuccessAt: now });
      } else {
        const now = new Date().toISOString();
        setApiStatus((prev) => ({ ...prev, state: "risk", detail: "Government endpoints unreachable. Check connection and refresh.", lastChecked: now }));
      }
    } catch (err) {
      setMsg(err?.message || "Failed to load government dashboard.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [loadAuditLogs, loadClaims, loadEnforcements, loadFraudAlerts, loadHealthFunds, loadHospitals, loadInspections, loadNotifications, loadOverview]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const openAudit = useCallback(async (claimId) => {
    if (!claimId) return;
    setAuditOpen(true);
    setAuditClaim(claimId);
    setAuditTrail([]);
    setAuditLoading(true);
    try {
      const res = await claimsService.getClaimAuditTrail?.(claimId);
      setAuditTrail(Array.isArray(res?.items) ? res.items : []);
    } catch (err) {
      setMsg(err?.message || "Failed to load audit trail.");
    } finally {
      setAuditLoading(false);
    }
  }, []);

  const closeAudit = useCallback(() => {
    setAuditOpen(false);
    setAuditClaim(null);
    setAuditTrail([]);
  }, []);

  const reviewClaim = useCallback(async (claimId, decision) => {
    if (!claimId) return;
    try {
      await claimsService.reviewClaim?.(claimId, { decision, notes: "" });
      await loadAll();
    } catch (err) {
      setMsg(err?.message || "Failed to review claim.");
    }
  }, [loadAll]);

  const requestVerification = useCallback(async (claimId) => {
    if (!claimId) return;
    try {
      await claimsService.requestVerification?.(claimId);
      await loadAll();
    } catch (err) {
      setMsg(err?.message || "Failed to request verification.");
    }
  }, [loadAll]);

  const assignAudit = useCallback(async (claimId) => {
    if (!claimId) return;
    try {
      await claimsService.assignAudit?.(claimId);
      await loadFraudAlerts();
    } catch (err) {
      setMsg(err?.message || "Failed to assign audit.");
    }
  }, [loadFraudAlerts]);

  const runPatientSearch = useCallback(async () => {
    if (!patientQuery.trim()) return;
    setPatientLoading(true);
    setPatientHistory(null);
    try {
      const res = await claimsService.getGovernmentPatientHistory?.(patientQuery.trim());
      setPatientHistory(res || null);
    } catch (err) {
      setMsg(err?.message || "Failed to load patient claims history.");
    } finally {
      setPatientLoading(false);
    }
  }, [patientQuery]);

  const createInspection = useCallback(async () => {
    if (!inspectionForm.hospitalId) return;
    try {
      await claimsService.createInspection?.(inspectionForm);
      setInspectionForm((prev) => ({ ...prev, scheduledAt: "", notes: "" }));
      await loadInspections();
      await loadOverview();
    } catch (err) {
      setMsg(err?.message || "Failed to schedule inspection.");
    }
  }, [inspectionForm, loadInspections, loadOverview]);

  const updateInspectionStatus = useCallback(async (id, status) => {
    if (!id) return;
    try {
      await claimsService.updateInspectionStatus?.(id, status);
      await loadInspections();
      await loadOverview();
    } catch (err) {
      setMsg(err?.message || "Failed to update inspection.");
    }
  }, [loadInspections, loadOverview]);

  const createEnforcement = useCallback(async () => {
    if (!enforcementForm.hospitalId) return;
    try {
      await claimsService.createEnforcement?.(enforcementForm);
      setEnforcementForm((prev) => ({ ...prev, amount: "", notes: "" }));
      await loadEnforcements();
      await loadOverview();
    } catch (err) {
      setMsg(err?.message || "Failed to create enforcement action.");
    }
  }, [enforcementForm, loadEnforcements, loadOverview]);

  const updateEnforcementStatus = useCallback(async (id, status) => {
    if (!id) return;
    try {
      await claimsService.updateEnforcementStatus?.(id, status);
      await loadEnforcements();
      await loadOverview();
    } catch (err) {
      setMsg(err?.message || "Failed to update enforcement action.");
    }
  }, [loadEnforcements, loadOverview]);

  const createHealthFund = useCallback(async () => {
    if (!fundForm.code || !fundForm.name || !fundForm.country) {
      setMsg("Health fund code, name, and country are required.");
      return;
    }
    try {
      await claimsService.createHealthFund?.(fundForm);
      setFundForm({ code: "", name: "", country: "", currency: "KES", status: "ACTIVE", apiStatus: "UNKNOWN" });
      await loadHealthFunds();
    } catch (err) {
      setMsg(err?.message || "Failed to create health fund.");
    }
  }, [fundForm, loadHealthFunds]);

  const updateHealthFund = useCallback(async (id, payload) => {
    try {
      await claimsService.updateHealthFund?.(id, payload);
      await loadHealthFunds();
    } catch (err) {
      setMsg(err?.message || "Failed to update health fund.");
    }
  }, [loadHealthFunds]);

  const memoizedOverview = useMemo(() => overview, [overview]);

  return {
    overview: memoizedOverview,
    claims,
    fraudAlerts,
    hospitals,
    inspections,
    enforcements,
    healthFunds,
    auditLogs,
    notifications,
    loading,
    msg,
    missingApi,
    apiStatus,
    auditOpen,
    auditClaim,
    auditTrail,
    auditLoading,
    patientQuery,
    setPatientQuery,
    patientHistory,
    patientLoading,
    inspectionForm,
    setInspectionForm,
    enforcementForm,
    setEnforcementForm,
    fundForm,
    setFundForm,
    loadAll,
    loadClaims,
    loadFraudAlerts,
    loadOverview,
    openAudit,
    closeAudit,
    reviewClaim,
    requestVerification,
    assignAudit,
    runPatientSearch,
    createInspection,
    updateInspectionStatus,
    createEnforcement,
    updateEnforcementStatus,
    createHealthFund,
    updateHealthFund,
  };
}

export default useGovernmentClaimsDashboard;
