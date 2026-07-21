import { useEffect, useState } from "react";
import { getTherapistDashboard } from "../services/dashboardApi";
import { listTransfers } from "../services/transferApi";

export function useTherapistDashboard() {
  const [data, setData] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");

  useEffect(() => {
    let active = true;
    getTherapistDashboard()
      .then((result) => {
        if (!active) return;
        setData(result);
      })
      .catch(() => {
        if (!active) return;
        setData(null);
      });

    listTransfers({ limit: 6, scope: "facility" })
      .then((res) => {
        if (!active) return;
        setTransfers(Array.isArray(res?.items) ? res.items : []);
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

  return { data, transfers, transferError };
}

export default useTherapistDashboard;
