import { useEffect, useMemo, useState } from "react";
import { fetchSignals } from "../services/launchReadinessApi";

export function useLaunchReadiness() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [signals, setSignals] = useState({
    backendHealth: null,
    aiGatewayHealth: null,
    systemSettings: null,
    offlineOps: null,
    trainingTracker: null,
  });

  const loadSignals = async () => {
    setLoading(true);
    setErr("");
    try {
      const s = await fetchSignals();
      setSignals(s || {});
    } catch (e) {
      setErr(String(e?.message || "Failed to load readiness signals"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSignals();
  }, []);

  const readinessScore = useMemo(() => {
    const checks = [
      Boolean(signals.backendHealth?.ok),
      Boolean(signals.aiGatewayHealth?.ok),
      Boolean(signals.systemSettings),
      Boolean(signals.offlineOps),
      Boolean(signals.trainingTracker),
    ];
    const passed = checks.filter(Boolean).length;
    return Math.round((passed / checks.length) * 100);
  }, [signals]);

  return {
    loading,
    err,
    signals,
    loadSignals,
    readinessScore,
  };
}

export default useLaunchReadiness;
