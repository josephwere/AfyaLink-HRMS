import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  approveTransferCommand,
  completeTransferCommand,
  getTransferDetailCommand,
  grantTransferConsentCommand,
  listTransferCommandCenterOverview,
  listTransferHospitals,
  rejectTransferCommand,
  requestTransferCommand,
  revokeTransferConsentCommand,
  searchTransferPatients,
} from "../services/hospitalAdminOperationsApi";
import { useAuth } from "../utils/auth";
import { normalizeRole } from "../utils/normalizeRole";
import { downloadTransferFhirBundle, downloadTransferHl7Export } from "../services/transferDownloadApi";

export function useTransferCommandCenter() {
  const { user } = useAuth();
  const role = normalizeRole(user?.role || "");
  const canRequest = ["DOCTOR", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"].includes(role);
  const canApprove = ["HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN"].includes(role);
  const canConsent = ["HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN"].includes(role);

  const [status, setStatus] = useState("");
  const [data, setData] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState({ handover: null, consent: null, audit: null });
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionMsg, setActionMsg] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionBusy, setActionBusy] = useState("");
  const [showHandover, setShowHandover] = useState(false);
  const [hospitals, setHospitals] = useState([]);
  const [patients, setPatients] = useState([]);
  const [patientSearch, setPatientSearch] = useState("");
  const [transferForm, setTransferForm] = useState({
    patientId: "",
    toHospitalId: "",
    reasons: "",
    handoverSummary: "",
    scopes: ["demographics", "encounters", "labs", "prescriptions"],
  });
  const [consentDraft, setConsentDraft] = useState({
    scopes: ["demographics", "encounters", "labs", "prescriptions"],
    expiresInDays: 30,
  });
  const queueSectionRef = useRef(null);

  const focusQueue = useCallback(() => {
    queueSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await listTransferCommandCenterOverview({ status, limit: 50 });
      setData(res || null);
      const firstId = res?.items?.[0]?._id ? String(res.items[0]._id) : "";
      setSelectedId((current) => current || firstId);
    } catch (err) {
      setError(err?.message || "Failed to load transfer command center");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    const loadHospitals = async () => {
      try {
        const canUseAdminList = ["HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"].includes(role);
        const res = await listTransferHospitals({
          limit: 1000,
          marketplace: !canUseAdminList,
        });
        if (!cancelled) {
          const items = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
          setHospitals(items);
        }
      } catch {
        if (!cancelled) setHospitals([]);
      }
    };
    void loadHospitals();
    return () => {
      cancelled = true;
    };
  }, [role]);

  useEffect(() => {
    let cancelled = false;
    const loadPatients = async () => {
      const q = patientSearch.trim();
      try {
        const res = await searchTransferPatients({ q, limit: 100 });
        if (!cancelled) {
          const items = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
          setPatients(items);
        }
      } catch {
        if (!cancelled) setPatients([]);
      }
    };
    void loadPatients();
    return () => {
      cancelled = true;
    };
  }, [patientSearch]);

  useEffect(() => {
    if (!selectedId) {
      setDetail({ handover: null, consent: null, audit: null });
      return;
    }
    setShowHandover(false);
    let cancelled = false;
    const loadDetail = async () => {
      setDetailLoading(true);
      try {
        const detailData = await getTransferDetailCommand(selectedId);
        if (!cancelled) setDetail(detailData || { handover: null, consent: null, audit: null });
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    };
    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    if (!detail?.consent) return;
    const scopes = Array.isArray(detail.consent.scopes) && detail.consent.scopes.length ? detail.consent.scopes : ["demographics", "encounters", "labs", "prescriptions"];
    const expiresAt = detail.consent.expiresAt ? new Date(detail.consent.expiresAt) : null;
    const expiresInDays = expiresAt ? Math.max(1, Math.round((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 30;
    setConsentDraft({ scopes, expiresInDays });
  }, [detail?.consent?.updatedAt]);

  const items = Array.isArray(data?.items) ? data.items : [];
  const selected = useMemo(
    () => items.find((row) => String(row._id) === String(selectedId)) || null,
    [items, selectedId]
  );

  const openSummaryView = useCallback(
    (kind) => {
      if (kind === "all") {
        setStatus("");
        focusQueue();
        return;
      }
      if (kind === "pending") {
        setStatus("Pending");
        focusQueue();
        return;
      }
      if (kind === "approved") {
        setStatus("Approved");
        focusQueue();
        return;
      }
      setStatus("");
      const matcher =
        kind === "consent"
          ? (row) => String(row?.consentStatus || "").toLowerCase().includes("pending")
          : kind === "overdue"
          ? (row) => Boolean(row?.overdue)
          : (row) => Number(row?.handoverCompletionScore || 0) < 70 || Number(row?.handoverMissingCount || 0) > 0;
      const match = items.find(matcher);
      if (match?._id) setSelectedId(String(match._id));
      focusQueue();
    },
    [focusQueue, items]
  );

  const resetActionState = useCallback(() => {
    setActionMsg("");
    setActionError("");
  }, []);

  const submitTransfer = useCallback(async () => {
    resetActionState();
    if (!transferForm.patientId || !transferForm.toHospitalId) {
      setActionError("Pick a patient and destination hospital.");
      return;
    }
    setActionBusy("request");
    try {
      await requestTransferCommand({
        patient: transferForm.patientId,
        toHospital: transferForm.toHospitalId,
        reasons: transferForm.reasons,
        scopes: transferForm.scopes,
        metadata: transferForm.handoverSummary ? { handoverSummary: transferForm.handoverSummary } : undefined,
      });
      setActionMsg("Transfer request sent.");
      setTransferForm((prev) => ({ ...prev, reasons: "", handoverSummary: "" }));
      await load();
    } catch (err) {
      setActionError(err?.message || "Failed to request transfer.");
    } finally {
      setActionBusy("");
    }
  }, [load, resetActionState, transferForm.patientId, transferForm.reasons, transferForm.handoverSummary, transferForm.scopes, transferForm.toHospitalId]);

  const doApprove = useCallback(async () => {
    if (!selected) return;
    resetActionState();
    setActionBusy("approve");
    try {
      await approveTransferCommand(selected._id);
      setActionMsg("Transfer approved.");
      await load();
    } catch (err) {
      setActionError(err?.message || "Failed to approve transfer.");
    } finally {
      setActionBusy("");
    }
  }, [load, resetActionState, selected]);

  const doReject = useCallback(async () => {
    if (!selected) return;
    resetActionState();
    const reason = window.prompt("Reason for rejection (optional):", "");
    if (reason === null) return;
    setActionBusy("reject");
    try {
      await rejectTransferCommand(selected._id, reason || "");
      setActionMsg("Transfer rejected.");
      await load();
    } catch (err) {
      setActionError(err?.message || "Failed to reject transfer.");
    } finally {
      setActionBusy("");
    }
  }, [load, resetActionState, selected]);

  const doComplete = useCallback(async ({ forceComplete = false } = {}) => {
    if (!selected) return;
    resetActionState();
    setActionBusy("complete");
    try {
      await completeTransferCommand(selected._id, { forceComplete });
      setActionMsg(forceComplete ? "Transfer completed with override." : "Transfer completed.");
      await load();
    } catch (err) {
      if (err?.status === 422 && !forceComplete) {
        const missing = Array.isArray(err?.data?.missing) ? err.data.missing.join(", ") : "Missing data";
        const ok = window.confirm(`Handover is incomplete: ${missing}. Complete with override?`);
        if (ok) return doComplete({ forceComplete: true });
      }
      setActionError(err?.message || "Failed to complete transfer.");
    } finally {
      setActionBusy("");
    }
  }, [load, resetActionState, selected]);

  const doGrantConsent = useCallback(async () => {
    if (!selected) return;
    resetActionState();
    setActionBusy("consent");
    try {
      const expiresIn = Number(consentDraft.expiresInDays || 0);
      const expiresAt = expiresIn > 0 ? new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000).toISOString() : undefined;
      await grantTransferConsentCommand(selected._id, { scopes: consentDraft.scopes, expiresAt });
      setActionMsg("Consent granted.");
      await load();
    } catch (err) {
      setActionError(err?.message || "Failed to grant consent.");
    } finally {
      setActionBusy("");
    }
  }, [consentDraft.expiresInDays, consentDraft.scopes, load, resetActionState, selected]);

  const doRevokeConsent = useCallback(async () => {
    if (!selected) return;
    resetActionState();
    setActionBusy("consent");
    try {
      await revokeTransferConsentCommand(selected._id);
      setActionMsg("Consent revoked.");
      await load();
    } catch (err) {
      setActionError(err?.message || "Failed to revoke consent.");
    } finally {
      setActionBusy("");
    }
  }, [load, resetActionState, selected]);

  const toggleScope = useCallback((scope, updater, value) => {
    updater((prev) => {
      const set = new Set(prev.scopes || []);
      if (value) set.add(scope);
      else set.delete(scope);
      return { ...prev, scopes: Array.from(set) };
    });
  }, []);

  return {
    canRequest,
    canApprove,
    canConsent,
    status,
    setStatus,
    data,
    selectedId,
    setSelectedId,
    detail,
    loading,
    detailLoading,
    error,
    actionMsg,
    actionError,
    actionBusy,
    showHandover,
    setShowHandover,
    hospitals,
    patients,
    patientSearch,
    setPatientSearch,
    transferForm,
    setTransferForm,
    consentDraft,
    setConsentDraft,
    queueSectionRef,
    focusQueue,
    load,
    openSummaryView,
    resetActionState,
    submitTransfer,
    doApprove,
    doReject,
    doComplete,
    doGrantConsent,
    doRevokeConsent,
    toggleScope,
    selected,
    items,
    downloadTransferFhirBundle,
    downloadTransferHl7Export,
  };
}

export default useTransferCommandCenter;
