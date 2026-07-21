import { useCallback, useEffect, useMemo, useState } from "react";
import claimsService from "../services/claims";

export function useClaimsDashboard() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [claims, setClaims] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [summary, setSummary] = useState({ totalClaims: 0, reviewClaims: 0, rejectedClaims: 0, openAlerts: 0 });
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditClaim, setAuditClaim] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditMsg, setAuditMsg] = useState("");
  const [reviewingId, setReviewingId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMsg("");
    try {
      const [summaryRes, claimRes, alertRes] = await Promise.all([
        claimsService.getSummary?.(),
        claimsService.listClaims?.({ limit: 50 }),
        claimsService.listAlerts?.({ status: "OPEN" }),
      ]);
      setSummary(summaryRes?.totals || { totalClaims: 0, reviewClaims: 0, rejectedClaims: 0, openAlerts: 0 });
      setClaims(Array.isArray(claimRes?.items) ? claimRes.items : []);
      setAlerts(Array.isArray(alertRes?.items) ? alertRes.items : []);
    } catch (err) {
      setMsg(err?.message || "Failed to load claims.");
      setSummary({ totalClaims: 0, reviewClaims: 0, rejectedClaims: 0, openAlerts: 0 });
      setClaims([]);
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openAudit = useCallback(async (claim) => {
    if (!claim?._id) return;
    setAuditOpen(true);
    setAuditClaim(claim);
    setAuditLogs([]);
    setAuditMsg("");
    setAuditLoading(true);
    try {
      const res = await claimsService.getAuditTrail?.(claim._id);
      setAuditLogs(Array.isArray(res?.items) ? res.items : []);
    } catch (err) {
      setAuditMsg(err?.message || "Failed to load claim audit.");
    } finally {
      setAuditLoading(false);
    }
  }, []);

  const closeAudit = useCallback(() => {
    setAuditOpen(false);
    setAuditClaim(null);
    setAuditLogs([]);
    setAuditMsg("");
  }, []);

  const reviewClaim = useCallback(async (claimId, decision) => {
    if (!claimId) return;
    setReviewingId(claimId);
    setMsg("");
    try {
      await claimsService.reviewClaim?.(claimId, { decision, notes: "" });
      await load();
    } catch (err) {
      setMsg(err?.message || "Failed to review claim.");
    } finally {
      setReviewingId("");
    }
  }, [load]);

  const stats = useMemo(() => {
    const rows = Array.isArray(claims) ? claims : [];
    const openAlerts = Array.isArray(alerts) ? alerts : [];
    const highRisk = rows.filter((c) => Number(c?.riskScore || 0) >= 75).length;
    const pending = rows.filter((c) => String(c?.status || "").toUpperCase() === "PENDING").length;
    return {
      openAlerts: summary.openAlerts || openAlerts.length,
      claimsLoaded: rows.length,
      highRisk,
      pending,
    };
  }, [alerts, claims, summary.openAlerts]);

  return {
    loading,
    msg,
    claims,
    alerts,
    auditOpen,
    auditClaim,
    auditLogs,
    auditLoading,
    auditMsg,
    summary,
    reviewingId,
    load,
    openAudit,
    closeAudit,
    reviewClaim,
    stats,
  };
}

export default useClaimsDashboard;
