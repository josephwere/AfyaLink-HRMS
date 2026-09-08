// Lightweight dashboard hook for aggregated finance KPIs.
import { useCallback, useState } from "react";

export default function useFinanceDashboard({ api } = {}) {
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadKpis = useCallback(async (opts = {}) => {
    setLoading(true);
    setError(null);
    try {
      if (!api || typeof api.fetchKpis !== "function") {
        // If no backend endpoint provided, return empty placeholder
        const placeholder = { revenue: 0, expenses: 0, cash: 0 };
        setKpis(placeholder);
        return placeholder;
      }
      const res = await api.fetchKpis(opts);
      setKpis(res);
      return res;
    } catch (err) {
      setError(err?.message || String(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [api]);

  return { kpis, loading, error, loadKpis };
}
