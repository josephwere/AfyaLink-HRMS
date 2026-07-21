import { useEffect, useState } from "react";
import { getPayrollDashboard } from "../services/dashboardApi";
import { listTransfers } from "../services/transferApi";

export function usePayrollOfficerDashboard(options = {}) {
  const [data, setData] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [dashboard, transfersData] = await Promise.all([
          getPayrollDashboard(),
          listTransfers(options),
        ]);
        if (!isMounted) return;
        setData(dashboard || null);
        setTransfers(Array.isArray(transfersData?.items) ? transfersData.items : []);
      } catch (e) {
        if (!isMounted) return;
        setError(e?.message || "Failed to load payroll dashboard");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void load();
    return () => {
      isMounted = false;
    };
  }, []);

  return { data, transfers, loading, error };
}

export default usePayrollOfficerDashboard;
