import { useCallback, useEffect, useMemo, useState } from "react";
import apiFetch from "../utils/apiFetch";

function formatCurrencyKES(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return "KES 0";
  return `KES ${amount.toLocaleString()}`;
}

export function useHospitalKPIDashboard() {
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadKPIs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch("/api/admin/kpis");
      setKpis(data || null);
    } catch (err) {
      setKpis(null);
      setError(err?.message || "Failed to load hospital KPIs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadKPIs();
    const timer = setInterval(() => {
      void loadKPIs();
    }, 30000);
    return () => clearInterval(timer);
  }, [loadKPIs]);

  const totalEncounters = useMemo(() => kpis?.encounters?.total ?? kpis?.totalEncounters ?? 0, [kpis]);
  const activeEncounters = useMemo(() => kpis?.encounters?.active ?? "—", [kpis]);
  const pendingInsurance = useMemo(() => kpis?.insurance?.pending ?? "—", [kpis]);
  const labPending = useMemo(() => kpis?.flow?.labPending ?? "—", [kpis]);
  const pharmacyPending = useMemo(() => kpis?.flow?.pharmacyPending ?? "—", [kpis]);
  const totalRevenue = useMemo(() => formatCurrencyKES(kpis?.billing?.totalRevenue || 0), [kpis]);

  return {
    kpis,
    loading,
    error,
    loadKPIs,
    totalEncounters,
    activeEncounters,
    pendingInsurance,
    labPending,
    pharmacyPending,
    totalRevenue,
  };
}

export default useHospitalKPIDashboard;
