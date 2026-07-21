import { useCallback, useEffect, useMemo, useState } from "react";
import { getDeveloperOverview, getTrustStatus, runWorkflowSlaScan } from "../services/developerApi";

const toneToBadge = {
  good: "OK",
  warn: "WATCH",
  risk: "ALERT",
};

export function useDeveloperDashboard() {
  const [data, setData] = useState(null);
  const [trust, setTrust] = useState(null);
  const [runningSla, setRunningSla] = useState(false);
  const [msg, setMsg] = useState(null);
  const [lastScan, setLastScan] = useState(null);

  const load = useCallback(async () => {
    try {
      const [overview, trustStatus] = await Promise.all([getDeveloperOverview(), getTrustStatus()]);
      setData(overview || null);
      setTrust(trustStatus?.trust || null);
    } catch {
      setData(null);
      setTrust(null);
    }
  }, []);

  useEffect(() => {
    void load();
    try {
      const stored = JSON.parse(localStorage.getItem("workflow_sla_last_scan") || "null");
      setLastScan(stored);
    } catch {
      setLastScan(null);
    }
  }, [load]);

  const runSla = useCallback(async () => {
    setRunningSla(true);
    setMsg(null);
    try {
      const result = await runWorkflowSlaScan();
      const l1 = result?.result?.workforce?.escalationsL1 ?? 0;
      const l2 = result?.result?.workforce?.escalationsL2 ?? 0;
      const nextScan = {
        lastScanAt: result?.ranAt || new Date().toISOString(),
        escalationsL1: l1,
        escalationsL2: l2,
        updatedAt: new Date().toISOString(),
      };
      setMsg(`Workflow SLA scan completed (L1: ${l1}, L2: ${l2})`);
      localStorage.setItem("workflow_sla_last_scan", JSON.stringify(nextScan));
      setLastScan(nextScan);
      await load();
    } catch (err) {
      setMsg(err?.message || "Failed to run workflow SLA scan");
    } finally {
      setRunningSla(false);
    }
  }, [load]);

  const workflowPending = Number(data?.queues?.workforce?.totalPending || 0);
  const queuePressure =
    Number(data?.queues?.dlq?.failed || 0) +
    Number(data?.queues?.webhook?.waiting || 0) +
    Number(data?.queues?.integration?.waiting || 0) +
    Number(data?.queues?.background?.byStatus?.FAILED || 0) +
    Number(data?.queues?.background?.byStatus?.DEAD_LETTER || 0);
  const trustPressure =
    Number(trust?.policyDenials24h || 0) +
    Number(trust?.consentDenials24h || 0) +
    Number(trust?.highRiskStepUps24h || 0);

  const routingTone = queuePressure > 40 ? "risk" : queuePressure > 10 ? "warn" : "good";
  const trustTone = trustPressure > 40 ? "risk" : trustPressure > 10 ? "warn" : "good";
  const workflowTone = workflowPending > 80 ? "risk" : workflowPending > 20 ? "warn" : "good";

  const formatTime = useCallback((value) => {
    if (!value) return "Not configured";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Not configured";
    return date.toLocaleString();
  }, []);

  return useMemo(
    () => ({
      data,
      trust,
      runningSla,
      msg,
      lastScan,
      load,
      runSla,
      workflowPending,
      queuePressure,
      trustPressure,
      routingTone,
      trustTone,
      workflowTone,
      formatTime,
      toneToBadge,
    }),
    [data, trust, runningSla, msg, lastScan, load, runSla, workflowPending, queuePressure, trustPressure, routingTone, trustTone, workflowTone, formatTime]
  );
}

export default useDeveloperDashboard;
