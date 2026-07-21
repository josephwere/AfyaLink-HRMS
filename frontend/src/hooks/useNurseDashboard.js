import { useEffect, useMemo, useState } from "react";
import { getNurseDashboard } from "../services/dashboardApi";
import { listTransfers } from "../services/transferApi";

export function useNurseDashboard() {
  const [data, setData] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const [dashboardData] = await Promise.all([
          getNurseDashboard().catch(() => null),
        ]);

        let transferItems = [];
        let transferErrorMessage = "";
        try {
          const transferResult = await listTransfers({ limit: 6, scope: "facility" });
          transferItems = Array.isArray(transferResult?.items) ? transferResult.items : [];
        } catch (err) {
          transferErrorMessage = err?.message || "Failed to load transfers.";
        }

        if (!active) return;

        setData(dashboardData);
        setTransfers(transferItems);
        setTransferError(transferErrorMessage);
      } catch (err) {
        if (!active) return;
        setData(null);
        setTransfers([]);
        setTransferError(err?.message || "Failed to load transfers.");
        setError(err?.message || "Failed to load nurse dashboard.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  const pendingTransferCount = useMemo(
    () => transfers.filter((transfer) => String(transfer?.status || "").toLowerCase() === "pending").length,
    [transfers]
  );
  const openEscalationCount = useMemo(() => Number(data?.escalationSummary?.openCount ?? data?.escalations?.open ?? 0), [data]);
  const pendingLeaveRequests = useMemo(() => Number(data?.pendingRequests?.leave ?? 0), [data]);
  const pendingLabOrders = useMemo(() => Number(data?.pendingLabOrders ?? 0), [data]);
  const patientsTotal = useMemo(() => Number(data?.patientsTotal ?? 0), [data]);

  return {
    data,
    transfers,
    transferError,
    loading,
    error,
    pendingTransferCount,
    openEscalationCount,
    pendingLeaveRequests,
    pendingLabOrders,
    patientsTotal,
  };
}

export default useNurseDashboard;
