import { useCallback, useEffect, useMemo, useState } from "react";
import { getHRDashboard } from "../services/dashboardApi";
import { runBurnoutScore, runCausalImpact } from "../services/mlApi";
import { listTrainingTrackers } from "../services/trainingTrackerApi";
import { listTransfers } from "../services/transferApi";

const initialTraining = {
  total: 0,
  notStarted: 0,
  inProgress: 0,
  completed: 0,
  overdueNotStarted: 0,
  overdueInProgress: 0,
  completionRate: 0,
};

const initialTrend = {
  burnoutScore: [],
  projectedKpi: [],
  projectedChange: [],
  trainingCompletion: [],
};

export function useHRManagerDashboard() {
  const [data, setData] = useState(null);
  const [burnout, setBurnout] = useState(null);
  const [causal, setCausal] = useState(null);
  const [training, setTraining] = useState(initialTraining);
  const [trend, setTrend] = useState(initialTrend);
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");

  const push = useCallback((key, value) => {
    setTrend((prev) => ({
      ...prev,
      [key]: [...(prev[key] || []), Number(value || 0)].slice(-12),
    }));
  }, []);

  const burnoutStatus = useCallback((score) => {
    const n = Number(score || 0);
    if (n >= 75) return "risk";
    if (n >= 45) return "warn";
    return "good";
  }, []);

  const changeStatus = useCallback((pct) => {
    const n = Number(pct || 0);
    if (n < 0) return "risk";
    if (n < 3) return "warn";
    return "good";
  }, []);

  const badgeFromStatus = useCallback((s) => (s === "risk" ? "ALERT" : s === "warn" ? "WATCH" : "OK"), []);

  const loadAi = useCallback(async () => {
    try {
      const [b, c] = await Promise.all([
        runBurnoutScore({
          hoursPerWeek: 50,
          nightShifts: 4,
          consecutiveDays: 6,
          overtimeHours: 10,
          leaveBalanceDays: 9,
          incidentsIn30d: 1,
        }),
        runCausalImpact({
          baseline: 100,
          interventions: [
            { name: "Shift rebalance", effectPct: 6, confidence: 0.75 },
            { name: "Fast-track hiring", effectPct: 8, confidence: 0.65 },
          ],
        }),
      ]);
      setBurnout(b || null);
      setCausal(c || null);
      push("burnoutScore", b?.score || 0);
      push("projectedKpi", c?.projected || 0);
      push("projectedChange", c?.changePct || 0);
    } catch {
      setBurnout(null);
      setCausal(null);
    }
  }, [push]);

  const loadData = useCallback(async () => {
    try {
      const dashboardData = await getHRDashboard();
      setData(dashboardData || null);
    } catch {
      setData(null);
    }

    try {
      const response = await listTrainingTrackers({ limit: 200 });
      const rows = Array.isArray(response?.items) ? response.items : [];
      const now = Date.now();
      const notStarted = rows.filter((r) => r.status === "NOT_STARTED").length;
      const inProgress = rows.filter((r) => r.status === "IN_PROGRESS").length;
      const completed = rows.filter((r) => r.status === "COMPLETED").length;
      const overdueNotStarted = rows.filter(
        (r) =>
          r.status === "NOT_STARTED" &&
          r.createdAt &&
          now - new Date(r.createdAt).getTime() >= 3 * 24 * 60 * 60 * 1000
      ).length;
      const overdueInProgress = rows.filter(
        (r) =>
          r.status === "IN_PROGRESS" &&
          r.updatedAt &&
          now - new Date(r.updatedAt).getTime() >= 7 * 24 * 60 * 60 * 1000
      ).length;
      const total = rows.length;
      const completionRate = total ? Math.round((completed / total) * 100) : 0;

      const nextTraining = {
        total,
        notStarted,
        inProgress,
        completed,
        overdueNotStarted,
        overdueInProgress,
        completionRate,
      };
      setTraining(nextTraining);
      push("trainingCompletion", completionRate);
    } catch {
      setTraining(initialTraining);
    }

    try {
      const response = await listTransfers({ limit: 8, scope: "facility" });
      const items = Array.isArray(response?.items) ? response.items : [];
      setTransfers(items);
      setTransferError("");
    } catch (err) {
      setTransfers([]);
      setTransferError(err?.message || "Failed to load transfers.");
    }
  }, [push]);

  useEffect(() => {
    void loadData();
    void loadAi();
    const timer = setInterval(() => {
      void loadAi();
    }, 45000);
    return () => clearInterval(timer);
  }, [loadAi, loadData]);

  return useMemo(
    () => ({
      data,
      burnout,
      causal,
      training,
      trend,
      transfers,
      transferError,
      burnoutStatus,
      changeStatus,
      badgeFromStatus,
      reloadAi: loadAi,
      reloadData: loadData,
    }),
    [badgeFromStatus, burnout, burnoutStatus, changeStatus, causal, data, loadAi, loadData, training, transferError, transfers, trend]
  );
}

export default useHRManagerDashboard;
