import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../utils/auth";
import { normalizeRole } from "../utils/normalizeRole";
import apiFetch from "../utils/apiFetch";
import { getRevenueIntelligenceSnapshot } from "../services/revenueIntelligenceApi";

function formatMoney(value) {
  return Number(value || 0).toLocaleString();
}

function formatPct(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function severityClass(severity) {
  switch (String(severity || "").toUpperCase()) {
    case "HIGH":
      return "warn";
    case "MEDIUM":
      return "watch";
    default:
      return "ok";
  }
}

export function useRevenueIntelligence() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const actorRole = normalizeRole(user?.actualRole || user?.role);
  const canSwitchHospital = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(actorRole);
  const [hospitalId, setHospitalId] = useState(() => searchParams.get("hospitalId") || "");
  const [snapshot, setSnapshot] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [clientMeta, setClientMeta] = useState(null);
  const requestRef = useRef(0);

  useEffect(() => {
    if (!canSwitchHospital) return;
    apiFetch("/api/hospitals/marketplace?limit=200")
      .then((res) => setHospitals(Array.isArray(res?.items) ? res.items : []))
      .catch(() => setHospitals([]));
  }, [canSwitchHospital]);

  const load = useCallback(
    async ({ nextHospitalId = hospitalId, preserveSnapshot = false } = {}) => {
      const requestId = requestRef.current + 1;
      requestRef.current = requestId;
      setLoading(true);
      setMsg("");
      try {
        const result = await getRevenueIntelligenceSnapshot({
          hospitalId: nextHospitalId || undefined,
        });
        if (requestRef.current !== requestId) return;
        setSnapshot(result?.payload || null);
        setClientMeta(result?.clientMeta || null);
      } catch (err) {
        if (requestRef.current !== requestId) return;
        if (!preserveSnapshot) setSnapshot(null);
        setMsg(err?.message || "We could not load revenue intelligence yet. Try again in a moment.");
      } finally {
        if (requestRef.current === requestId) setLoading(false);
      }
    },
    [hospitalId]
  );

  useEffect(() => {
    void load({ nextHospitalId: hospitalId, preserveSnapshot: false });
  }, [hospitalId, load]);

  const hasSnapshot = Boolean(snapshot);
  const initialLoading = loading && !hasSnapshot;
  const refreshing = loading && hasSnapshot;

  const summary = snapshot?.summary || {};
  const actions = snapshot?.actions || [];
  const payerMix = snapshot?.payerMix || [];
  const overdueInvoices = snapshot?.overdueInvoices || [];
  const topDenialReasons = snapshot?.topDenialReasons || [];
  const preauthSummary = snapshot?.preauthSummary || [];
  const hospitalComparisons = snapshot?.hospitalComparisons || [];

  const summaryCards = useMemo(
    () => [
      {
        title: "Outstanding A/R",
        value: formatMoney(summary.outstandingAmount),
        onClick: () => window.scrollTo({ top: 980, behavior: "smooth" }),
      },
      {
        title: "Collected",
        value: formatMoney(summary.collectedAmount),
        onClick: () => navigate("/hospital-admin/financials"),
      },
      {
        title: "Denial Rate",
        value: formatPct(summary.denialRate),
        onClick: () => window.scrollTo({ top: 1320, behavior: "smooth" }),
      },
      {
        title: "Pending Preauth SLA",
        value: summary.pendingPreauthOverSla ?? 0,
        onClick: () => window.scrollTo({ top: 1560, behavior: "smooth" }),
      },
      {
        title: "High-Risk Claims",
        value: summary.highRiskClaimCount ?? 0,
        onClick: () => navigate("/hospital-admin/claims"),
      },
      {
        title: "Avg Collection Days",
        value: summary.averageCollectionDays ?? 0,
        onClick: () => navigate("/payments/full"),
      },
    ],
    [navigate, summary]
  );

  return {
    navigate,
    hospitalId,
    setHospitalId,
    searchParams,
    setSearchParams,
    canSwitchHospital,
    snapshot,
    hospitals,
    loading,
    msg,
    clientMeta,
    load,
    hasSnapshot,
    initialLoading,
    refreshing,
    summary,
    actions,
    payerMix,
    overdueInvoices,
    topDenialReasons,
    preauthSummary,
    hospitalComparisons,
    summaryCards,
    severityClass,
  };
}

export default useRevenueIntelligence;
