import { useEffect, useMemo, useState } from "react";
import { getRadiologistDashboard } from "../services/dashboardApi";
import { listTransfers } from "../services/transferApi";

export function useRadiologistDashboard() {
  const [data, setData] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");

  useEffect(() => {
    let active = true;

    getRadiologistDashboard()
      .then((value) => {
        if (active) setData(value || null);
      })
      .catch(() => {
        if (active) setData(null);
      });

    listTransfers({ limit: 6, scope: "facility" })
      .then((resp) => {
        if (!active) return;
        const items = Array.isArray(resp?.items) ? resp.items : Array.isArray(resp) ? resp : [];
        setTransfers(items);
        setTransferError("");
      })
      .catch((err) => {
        if (!active) return;
        setTransfers([]);
        setTransferError(err?.message || "Failed to load transfers.");
      });

    return () => {
      active = false;
    };
  }, []);

  const pendingTransfers = useMemo(
    () => transfers.filter((t) => String(t?.status || "").toUpperCase() === "PENDING").length,
    [transfers]
  );

  return {
    data,
    transfers,
    transferError,
    pendingTransfers,
  };
}

export default useRadiologistDashboard;
