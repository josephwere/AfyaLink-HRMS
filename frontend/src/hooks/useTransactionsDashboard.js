import { useCallback, useEffect, useMemo, useState } from "react";
import { downloadApiFile } from "../lib/api/client";
import {
  exportTransactionsCsv,
  getRevenueDaily,
  getTransactionSummary,
  listTransactions,
} from "../services/transactionsApi";

const DEFAULT_FILTERS = {
  provider: "",
  status: "",
  min: "",
  max: "",
  start: "",
  end: "",
  search: "",
};

export function useTransactionsDashboard() {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const succeededTotal = useMemo(
    () => (summary || []).reduce((acc, s) => acc + Number(s?.total || 0), 0),
    [summary]
  );

  const activeFilterCount = useMemo(() => {
    return Object.entries(filters || {}).filter(([, value]) => String(value || "").trim() !== "").length;
  }, [filters]);

  const refresh = useCallback(async (opts = {}) => {
    const exportCsv = Boolean(opts.exportCsv);
    const currentFilters = opts.filters || filters;
    const qs = new URLSearchParams({ ...currentFilters, limit: "500" });
    if (exportCsv) qs.set("exportCsv", "1");
    const query = qs.toString();

    if (exportCsv) {
      await exportTransactionsCsv(query);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const [tx, sum, daily] = await Promise.all([
        listTransactions(query),
        getTransactionSummary(),
        getRevenueDaily(),
      ]);
      setRows(Array.isArray(tx?.data) ? tx.data : Array.isArray(tx) ? tx : []);
      setSummary(Array.isArray(sum?.data) ? sum.data : Array.isArray(sum) ? sum : []);
      setChartData(Array.isArray(daily) ? daily : Array.isArray(daily?.items) ? daily.items : []);
    } catch (err) {
      setRows([]);
      setSummary([]);
      setChartData([]);
      setError(err?.message || "Failed to load transactions.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const applyFilters = useCallback(async () => {
    await refresh({ filters });
  }, [filters, refresh]);

  const resetFilters = useCallback(async () => {
    const next = { ...DEFAULT_FILTERS };
    setFilters(next);
    await refresh({ filters: next });
  }, [refresh]);

  const setFilter = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  return {
    rows,
    summary,
    chartData,
    filters,
    setFilter,
    loading,
    error,
    succeededTotal,
    activeFilterCount,
    refresh,
    applyFilters,
    resetFilters,
  };
}

export default useTransactionsDashboard;
