import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createComplianceLegalHold,
  getComplianceCenter,
  releaseComplianceLegalHold,
} from "../services/complianceApi";

export function useComplianceCenter() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [clientMeta, setClientMeta] = useState(null);
  const [saving, setSaving] = useState(false);
  const [releasingId, setReleasingId] = useState("");
  const requestRef = useRef(0);
  const [form, setForm] = useState({
    title: "",
    description: "",
    region: "KE",
    scopeType: "SYSTEM",
    scopeRef: "",
    legalBasis: "",
    retentionOverrideDays: "",
    notes: "",
  });

  const load = useCallback(async ({ preserveData = false } = {}) => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setLoading(true);
    setLoadError("");
    try {
      const res = await getComplianceCenter();
      if (requestRef.current !== requestId) return;
      setData(res?.payload || null);
      setClientMeta(res?.clientMeta || null);
    } catch (err) {
      if (requestRef.current !== requestId) return;
      if (!preserveData) setData(null);
      setLoadError(err?.message || "We could not load the compliance center yet. Try again in a moment.");
    } finally {
      if (requestRef.current === requestId) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load({ preserveData: false });
  }, [load]);

  const hasData = Boolean(data);
  const initialLoading = loading && !hasData;
  const refreshing = loading && hasData;

  const summary = data?.auditSummary || {};
  const settings = data?.settings || {};
  const activeHolds = data?.activeHolds || [];
  const recentHolds = data?.recentHolds || [];
  const evidencePacks = data?.evidencePacks || [];

  const summaryCards = useMemo(() => [
    { title: "Audit Events (7d)", value: summary.events7d ?? 0 },
    { title: "Export Events (30d)", value: summary.exportEvents30d ?? 0 },
    { title: "Audit Failures (30d)", value: summary.failures30d ?? 0 },
    { title: "Active Legal Holds", value: activeHolds.length },
    { title: "Audit Retention", value: `${settings.auditRetentionDays ?? 365} days` },
    { title: "Clinical Record Retention", value: `${settings.clinicalRecordRetentionYears ?? 7} years` },
  ], [activeHolds.length, settings.auditRetentionDays, settings.clinicalRecordRetentionYears, summary.events7d, summary.exportEvents30d, summary.failures30d]);

  const createHold = useCallback(async (event) => {
    event.preventDefault();
    setSaving(true);
    setStatusMessage("");
    try {
      await createComplianceLegalHold({
        ...form,
        retentionOverrideDays: form.retentionOverrideDays === "" ? null : Number(form.retentionOverrideDays),
      });
      setForm({
        title: "",
        description: "",
        region: settings.defaultRegion || "KE",
        scopeType: "SYSTEM",
        scopeRef: "",
        legalBasis: "",
        retentionOverrideDays: "",
        notes: "",
      });
      setStatusMessage("Legal hold created.");
      await load({ preserveData: true });
    } catch (err) {
      setStatusMessage(err?.message || "Failed to create legal hold.");
    } finally {
      setSaving(false);
    }
  }, [form, load, settings.defaultRegion]);

  const releaseHold = useCallback(async (holdId) => {
    setReleasingId(holdId);
    setStatusMessage("");
    try {
      await releaseComplianceLegalHold(holdId, { notes: "Released from compliance center" });
      setStatusMessage("Legal hold released.");
      await load({ preserveData: true });
    } catch (err) {
      setStatusMessage(err?.message || "Failed to release legal hold.");
    } finally {
      setReleasingId("");
    }
  }, [load]);

  return {
    data,
    loading,
    loadError,
    statusMessage,
    clientMeta,
    saving,
    releasingId,
    form,
    setForm,
    load,
    hasData,
    initialLoading,
    refreshing,
    summary,
    settings,
    activeHolds,
    recentHolds,
    evidencePacks,
    summaryCards,
    createHold,
    releaseHold,
  };
}

export default useComplianceCenter;
