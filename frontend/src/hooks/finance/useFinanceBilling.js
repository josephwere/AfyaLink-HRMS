import { useCallback, useEffect, useState } from "react";
import { listInvoices, getInvoice } from "../../services/finance/billingApi";

export default function useFinanceBilling(initialFilters = {}) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(initialFilters);

  const loadInvoices = useCallback(
    async (opts = {}) => {
      setLoading(true);
      setError(null);
      try {
        const params = { ...filters, ...opts };
        const res = await listInvoices(params);
        const rows = Array.isArray(res) ? res : res?.items || res?.invoices || [];
        setInvoices(rows);
        return rows;
      } catch (err) {
        setError(err?.message || String(err));
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [filters]
  );

  const search = useCallback(
    async (query) => {
      // Basic client-side search after fetching a reasonably-sized list
      const rows = await loadInvoices();
      const q = String(query || "").toLowerCase();
      if (!q) return rows;
      const filtered = rows.filter((inv) => {
        return (
          String(inv.billing?.invoiceNumber || "").toLowerCase().includes(q) ||
          String(inv.patient?.firstName || "").toLowerCase().includes(q) ||
          String(inv.patient?.lastName || "").toLowerCase().includes(q) ||
          String(inv.patient?.hospitalNumber || "").toLowerCase().includes(q)
        );
      });
      setInvoices(filtered);
      return filtered;
    },
    [loadInvoices]
  );

  const refreshInvoice = useCallback(
    async (id) => {
      try {
        const fresh = await getInvoice(id);
        setInvoices((prev) => prev.map((p) => (p._id === id ? fresh : p)));
        return fresh;
      } catch (err) {
        setError(err?.message || String(err));
        throw err;
      }
    },
    []
  );

  const updateInvoiceLocally = useCallback((updated) => {
    if (!updated || !updated._id) return;
    setInvoices((prev) => {
      const found = prev.find((p) => p._id === updated._id);
      if (found) return prev.map((p) => (p._id === updated._id ? { ...found, ...updated } : p));
      return [updated, ...prev];
    });
  }, []);

  useEffect(() => {
    // initial load
    loadInvoices().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    invoices,
    loading,
    error,
    filters,
    setFilters,
    loadInvoices,
    search,
    refreshInvoice,
    updateInvoiceLocally,
  };
}
