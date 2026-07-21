import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getAdminDashboardMetrics,
  listAdminDashboardTransfers,
} from "../services/adminDashboardApi";

export function useAdminDashboard() {
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");
  const [metrics, setMetrics] = useState({
    hospitals: 0,
    staff: 0,
    supportTickets: 0,
  });
  const [metricsError, setMetricsError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [transferData, metricsData] = await Promise.all([
        listAdminDashboardTransfers({ limit: 6, scope: "global" }),
        getAdminDashboardMetrics(),
      ]);
      const items = Array.isArray(transferData?.items)
        ? transferData.items
        : Array.isArray(transferData)
          ? transferData
          : [];
      setTransfers(items);
      setTransferError("");
      setMetrics({
        hospitals: Number(metricsData?.hospitals ?? 0),
        staff: Number(metricsData?.staff ?? 0),
        supportTickets: Number(metricsData?.supportTickets ?? 0),
      });
      setMetricsError("");
    } catch (err) {
      setTransfers([]);
      setTransferError(err?.message || "Unable to load transfers.");
      setMetrics({ hospitals: 0, staff: 0, supportTickets: 0 });
      setMetricsError(err?.message || "Unable to load live operations counts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingTransfers = useMemo(() => transfers.filter((t) => t.status === "Pending").length, [transfers]);

  return {
    transfers,
    transferError,
    metrics,
    metricsError,
    loading,
    pendingTransfers,
    load,
  };
}

export default useAdminDashboard;
