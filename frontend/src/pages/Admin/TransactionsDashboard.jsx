import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import DashboardHomeShell, { DashboardSection } from "../../components/DashboardHomeShell";
import { downloadApiFile } from "../../lib/api/client";
import apiFetch from "../../utils/apiFetch";
import { formatCurrency, formatDateTime } from "../../utils/locale";

const PROVIDERS = [
  { value: "", label: "All providers" },
  { value: "stripe", label: "Stripe" },
  { value: "mpesa", label: "M-Pesa" },
  { value: "flutterwave", label: "Flutterwave" },
];

const STATUSES = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "succeeded", label: "Succeeded" },
  { value: "failed", label: "Failed" },
];

function formatCurrencyKES(value) {
  return formatCurrency(value, "KES");
}

export default function TransactionsDashboard() {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [filters, setFilters] = useState({
    provider: "",
    status: "",
    min: "",
    max: "",
    start: "",
    end: "",
    search: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const succeededTotal = useMemo(
    () => (summary || []).reduce((acc, s) => acc + Number(s?.total || 0), 0),
    [summary]
  );
  const activeFilterCount = useMemo(() => {
    return Object.entries(filters || {}).filter(([, value]) => String(value || "").trim() !== "").length;
  }, [filters]);

  const fetchData = useCallback(async (opts = {}) => {
    const exportCsv = Boolean(opts.exportCsv);
    const currentFilters = opts.filters || filters;
    const qs = new URLSearchParams({ ...currentFilters, limit: "500" });
    if (exportCsv) qs.set("exportCsv", "1");
    const query = qs.toString();

    if (exportCsv) {
      await downloadApiFile(`/api/transactions?${query}`, {
        filename: "transactions.csv",
        headers: { Accept: "text/csv" },
      });
      return;
    }

    setLoading(true);
    setError("");
    try {
      const [tx, sum, daily] = await Promise.all([
        apiFetch(`/api/transactions?${query}`),
        apiFetch("/api/transactions/summary"),
        apiFetch("/api/analytics/revenue/daily"),
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
    fetchData().catch(() => {});
  }, [fetchData]);

  const applyFilters = async () => {
    await fetchData({ filters });
  };

  const resetFilters = async () => {
    const next = { provider: "", status: "", min: "", max: "", start: "", end: "", search: "" };
    setFilters(next);
    await fetchData({ filters: next });
  };

  const COLORS = ["#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", "#64748b"];

  return (
    <DashboardHomeShell
      shellKey="revenue_transactions"
      kicker="Revenue"
      title="Transactions"
      subtitle="Filter, review, chart, and export transaction activity."
      actions={[
        { label: "Refresh", onClick: () => fetchData(), variant: "secondary" },
        { label: "Export CSV", onClick: () => fetchData({ exportCsv: true }) },
      ]}
      stats={[
        { label: "Loaded", value: rows.length, note: "Rows in view" },
        { label: "Succeeded revenue", value: formatCurrencyKES(succeededTotal), note: "Providers summary" },
        { label: "Providers", value: summary.length, note: "Succeeded only" },
        { label: "Filters", value: activeFilterCount, note: "Active" },
      ]}
    >
      <DashboardSection
        title="Filters"
        subtitle="Apply filters to narrow the transaction worklist. Export respects your filters and date range."
        actions={[
          { label: "Apply", onClick: () => applyFilters() },
          { label: "Reset", onClick: () => resetFilters(), variant: "secondary" },
        ]}
      >
        <div className="welcome-actions">
          <input
            placeholder="Search reference or patient"
            value={filters.search}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
          />
          <select
            value={filters.provider}
            onChange={(e) => setFilters((prev) => ({ ...prev, provider: e.target.value }))}
          >
            {PROVIDERS.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            value={filters.status}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
          >
            {STATUSES.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Min"
            value={filters.min}
            onChange={(e) => setFilters((prev) => ({ ...prev, min: e.target.value }))}
          />
          <input
            type="number"
            placeholder="Max"
            value={filters.max}
            onChange={(e) => setFilters((prev) => ({ ...prev, max: e.target.value }))}
          />
          <input
            type="date"
            value={filters.start}
            onChange={(e) => setFilters((prev) => ({ ...prev, start: e.target.value }))}
          />
          <input
            type="date"
            value={filters.end}
            onChange={(e) => setFilters((prev) => ({ ...prev, end: e.target.value }))}
          />
        </div>
      </DashboardSection>

      <DashboardSection
        title="Revenue Trend"
        subtitle="Daily succeeded revenue trend (source: analytics)."
      >
        <div className="card" style={{ height: 320 }}>
          <ResponsiveContainer>
            <LineChart data={chartData || []}>
              <XAxis dataKey="_id" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="total" stroke="#0ea5e9" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </DashboardSection>

      <DashboardSection title="Provider Distribution" subtitle="Succeeded revenue by provider (summary endpoint).">
        <div className="card" style={{ height: 320 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie data={summary || []} dataKey="total" nameKey="_id" cx="50%" cy="50%" outerRadius={88}>
                {(summary || []).map((entry, index) => (
                  <Cell key={entry?._id || index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(val) => formatCurrencyKES(val)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </DashboardSection>

      <DashboardSection title="Transaction Worklist" subtitle="Review the latest transactions that match your filters.">
        {error ? (
          <div className="muted" style={{ color: "#dc2626", marginBottom: 12 }}>
            {error}
          </div>
        ) : null}
        <div className="card">
          <div className="table-wrap">
            <table className="table lite">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Provider</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5" className="muted">
                      Loading…
                    </td>
                  </tr>
                ) : null}
                {!loading && rows.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="muted">
                      No transactions found.
                    </td>
                  </tr>
                ) : null}
                {rows.map((r) => (
                  <tr key={r._id}>
                    <td>{r.reference || "—"}</td>
                    <td>{r.provider || "—"}</td>
                    <td>{formatCurrencyKES(r.amount)}</td>
                    <td>{r.status || "—"}</td>
                    <td>{r.createdAt ? formatDateTime(r.createdAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </DashboardSection>
    </DashboardHomeShell>
  );
}
