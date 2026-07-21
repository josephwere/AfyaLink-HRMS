import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getSystemAdminMetrics,
  getRiskPolicy,
  updateRiskPolicy,
  getIntegrationControlPlane,
  getCountyCommandCenterSummary,
} from "../services/systemAdminApi";
import { getDeveloperOverview, getTrustStatus, runWorkflowSlaScan } from "../services/developerApi";
import { listTrainingTrackers } from "../services/trainingTrackerApi";
import { listTransfers } from "../services/transferApi";
import { guardedConsoleFetch } from "../services/guardedConsoleFetch";

function clampNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function useSystemAdminDashboard() {
  const [metrics, setMetrics] = useState(null);
  const [devOverview, setDevOverview] = useState(null);
  const [trust, setTrust] = useState(null);
  const [controlPlane, setControlPlane] = useState(null);
  const [county, setCounty] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");
  const [training, setTraining] = useState({
    total: 0,
    notStarted: 0,
    inProgress: 0,
    completed: 0,
    overdueNotStarted: 0,
    overdueInProgress: 0,
    completionRate: 0,
  });
  const [unlinkedPharmacists, setUnlinkedPharmacists] = useState(0);
  const [runningSla, setRunningSla] = useState(false);
  const [msg, setMsg] = useState(null);
  const [riskPolicy, setRiskPolicy] = useState(null);
  const [savingRisk, setSavingRisk] = useState(false);
  const [riskDrawerOpen, setRiskDrawerOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [metricsRes, devOverviewRes, trustRes] = await Promise.all([
        getSystemAdminMetrics(),
        getDeveloperOverview(),
        getTrustStatus(),
      ]);
      setMetrics(metricsRes || null);
      setDevOverview(devOverviewRes || null);
      setTrust(trustRes?.trust || null);
    } catch {
      setMetrics(null);
      setDevOverview(null);
      setTrust(null);
    }

    try {
      const res = await getIntegrationControlPlane();
      setControlPlane(res || null);
    } catch {
      setControlPlane(null);
    }

    try {
      const res = await getCountyCommandCenterSummary();
      setCounty(res || null);
    } catch {
      setCounty(null);
    }

    try {
      const policy = await getRiskPolicy();
      setRiskPolicy(policy || null);
    } catch {
      setRiskPolicy(null);
    }

    try {
      const res = await listTransfers({ limit: 10, scope: "global" });
      const items = Array.isArray(res?.items) ? res.items : [];
      setTransfers(items);
      setTransferError("");
    } catch (err) {
      setTransfers([]);
      setTransferError(err?.message || "Failed to load transfers.");
    }

    try {
      const res = await listTrainingTrackers({ limit: 300 });
      const rows = Array.isArray(res?.items) ? res.items : [];
      const now = Date.now();
      const notStarted = rows.filter((row) => row.status === "NOT_STARTED").length;
      const inProgress = rows.filter((row) => row.status === "IN_PROGRESS").length;
      const completed = rows.filter((row) => row.status === "COMPLETED").length;
      const overdueNotStarted = rows.filter(
        (row) => row.status === "NOT_STARTED" && row.createdAt && now - new Date(row.createdAt).getTime() >= 3 * 24 * 60 * 60 * 1000
      ).length;
      const overdueInProgress = rows.filter(
        (row) => row.status === "IN_PROGRESS" && row.updatedAt && now - new Date(row.updatedAt).getTime() >= 7 * 24 * 60 * 60 * 1000
      ).length;
      const total = rows.length;
      const completionRate = total ? Math.round((completed / total) * 100) : 0;
      setTraining({ total, notStarted, inProgress, completed, overdueNotStarted, overdueInProgress, completionRate });
    } catch {
      setTraining({ total: 0, notStarted: 0, inProgress: 0, completed: 0, overdueNotStarted: 0, overdueInProgress: 0, completionRate: 0 });
    }

    try {
      const result = await guardedConsoleFetch("/api/users?missingRegisteredPharmacy=1&page=1&limit=500", {
        warmupKey: "system-admin-unlinked-pharmacists",
      });
      const res = result?.payload || {};
      const rows = Array.isArray(res?.items) ? res.items : [];
      setUnlinkedPharmacists(rows.length);
    } catch {
      setUnlinkedPharmacists(0);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const readyControlModules = useMemo(
    () => controlPlane?.controlPlanes?.filter((row) => row.readiness === "READY").length ?? 0,
    [controlPlane]
  );

  const pendingTransfers = useMemo(() => transfers.filter((item) => item.status === "Pending").length, [transfers]);
  const transferPreview = useMemo(() => transfers.slice(0, 8), [transfers]);

  const closeRiskDrawer = useCallback(() => setRiskDrawerOpen(false), []);
  const openRiskDrawer = useCallback(() => {
    setMsg(null);
    setRiskDrawerOpen(true);
  }, []);

  const runSla = useCallback(async () => {
    setRunningSla(true);
    setMsg(null);
    try {
      const res = await runWorkflowSlaScan();
      const l1 = res?.result?.workforce?.escalationsL1 ?? 0;
      const l2 = res?.result?.workforce?.escalationsL2 ?? 0;
      setMsg(`SLA scan completed (L1: ${l1}, L2: ${l2})`);
      await load();
    } catch (err) {
      setMsg(err?.message || "Failed to run SLA scan");
    } finally {
      setRunningSla(false);
    }
  }, [load]);

  const saveRiskPolicy = useCallback(async () => {
    if (!riskPolicy) return;
    setSavingRisk(true);
    setMsg(null);
    try {
      const updated = await updateRiskPolicy(riskPolicy);
      setRiskPolicy(updated || riskPolicy);
      setMsg("Adaptive risk policy updated.");
    } catch (err) {
      setMsg(err?.message || "Failed to update risk policy");
    } finally {
      setSavingRisk(false);
    }
  }, [riskPolicy]);

  return {
    metrics,
    devOverview,
    trust,
    controlPlane,
    county,
    transfers,
    transferError,
    training,
    unlinkedPharmacists,
    runningSla,
    msg,
    setMsg,
    riskPolicy,
    setRiskPolicy,
    savingRisk,
    riskDrawerOpen,
    setRiskDrawerOpen,
    readyControlModules,
    pendingTransfers,
    transferPreview,
    load,
    closeRiskDrawer,
    openRiskDrawer,
    runSla,
    saveRiskPolicy,
    clampNumber,
  };
}

export default useSystemAdminDashboard;
