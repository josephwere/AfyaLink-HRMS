import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getOfflineMetricsSnapshot, refreshOfflineMetricsSnapshot } from "../utils/offlineQueue";
import { getOfflineOpsMetrics, getOfflineQueueStatus } from "../services/offlineOpsApi";

export function useOfflineOps({ hours = 72, q = "" } = {}) {
  const filtersRef = useRef(null);
  const moduleTableRef = useRef(null);
  const clientSignalsRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [server, setServer] = useState(null);
  const [queueStatus, setQueueStatus] = useState(null);
  const [local, setLocal] = useState(() => getOfflineMetricsSnapshot());
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const [metrics, status] = await Promise.all([
        getOfflineOpsMetrics({ hours, q, limit: 150 }),
        getOfflineQueueStatus().catch(() => null),
      ]);
      setServer(metrics || null);
      setQueueStatus(status || null);
      setLocal(refreshOfflineMetricsSnapshot());
    } catch (e) {
      setErr(String(e?.message || "Failed to load offline metrics"));
    } finally {
      setLoading(false);
    }
  }, [hours, q]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onUpdate = (ev) => setLocal(ev?.detail || getOfflineMetricsSnapshot());
    window.addEventListener("afyalink:offline-metrics-updated", onUpdate);
    const timer = setInterval(() => {
      void load();
    }, 30000);
    return () => {
      window.removeEventListener("afyalink:offline-metrics-updated", onUpdate);
      clearInterval(timer);
    };
  }, [load]);

  const moduleRows = useMemo(() => server?.byModule || [], [server]);

  return {
    filtersRef,
    moduleTableRef,
    clientSignalsRef,
    loading,
    server,
    queueStatus,
    local,
    err,
    load,
    moduleRows,
  };
}

export default useOfflineOps;
