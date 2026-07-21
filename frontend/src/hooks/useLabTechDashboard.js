import { useEffect, useState } from "react";
import { getLabTechDashboard } from "../services/dashboardApi";
import { listTransfers } from "../services/transferApi";

export function useLabTechDashboard() {
  const [data, setData] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");

  useEffect(() => {
    getLabTechDashboard().then(setData).catch(() => setData(null));
    listTransfers({ limit: 6, scope: "facility" })
      .then((res) => {
        const items = Array.isArray(res?.items) ? res.items : [];
        setTransfers(items);
        setTransferError("");
      })
      .catch((err) => {
        setTransfers([]);
        setTransferError(err?.message || "Failed to load transfers.");
      });
  }, []);

  return { data, transfers, transferError };
}

export default useLabTechDashboard;
