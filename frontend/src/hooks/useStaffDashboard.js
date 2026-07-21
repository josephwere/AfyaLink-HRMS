import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../utils/auth";
import { getStaffDashboard } from "../services/dashboardApi";
import { listTransfers } from "../services/transferApi";

export function useStaffDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");

  useEffect(() => {
    let active = true;

    getStaffDashboard()
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
        setTransferError(err?.message || "Unable to load transfers.");
      });

    return () => {
      active = false;
    };
  }, []);

  const role = useMemo(() => String(user?.role || "").toUpperCase(), [user?.role]);

  return {
    data,
    transfers,
    transferError,
    role,
  };
}

export default useStaffDashboard;
