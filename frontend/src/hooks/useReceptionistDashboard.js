import { useEffect, useMemo, useState } from "react";
import { getReceptionistDashboard } from "../services/dashboardApi";
import { listTransfers } from "../services/transferApi";

export function useReceptionistDashboard() {
  const [data, setData] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const [dashboardData, transferData] = await Promise.all([
          getReceptionistDashboard(),
          listTransfers({ limit: 6, scope: "facility" }),
        ]);
        if (!active) return;
        setData(dashboardData || null);
        setTransfers(Array.isArray(transferData?.items) ? transferData.items : []);
        setTransferError("");
      } catch (err) {
        if (!active) return;
        setData(null);
        setTransfers([]);
        setTransferError(err?.message || "Failed to load transfers.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  const pendingTransferCount = useMemo(() => transfers.filter((transfer) => String(transfer?.status || "").toLowerCase() === "pending").length, [transfers]);

  return {
    data,
    transfers,
    transferError,
    pendingTransferCount,
    loading,
  };
}

export default useReceptionistDashboard;
