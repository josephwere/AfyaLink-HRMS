import { useCallback, useEffect, useMemo, useState } from "react";
import billingService from "../services/billing";

export function useFinancials({ page = 1, limit = 25 } = {}) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ patient: "", items: [{ description: "Consultation", amount: 50 }] });
  const [currentPage, setCurrentPage] = useState(page);

  const load = useCallback(async (nextPage = currentPage) => {
    setLoading(true);
    setMsg("");
    try {
      const result = await billingService.listFinancials?.({ page: nextPage, limit }) ?? { items: [], total: 0 };
      const payload = result && typeof result === "object" ? result : {};
      const rows = Array.isArray(result) ? result : Array.isArray(payload.items) ? payload.items : [];
      setItems(rows);
      setTotal(Number(payload.total || rows.length || 0));
      setCurrentPage(nextPage);
    } catch (err) {
      setItems([]);
      setTotal(0);
      setMsg(err?.message || "Failed to load financials.");
    } finally {
      setLoading(false);
    }
  }, [currentPage, limit]);

  useEffect(() => {
    void load(currentPage);
  }, [currentPage, load]);

  const createInvoice = useCallback(async (payload) => {
    setLoading(true);
    setMsg("");
    try {
      await billingService.createFinancial?.({ ...form, ...payload });
      setForm({ patient: "", items: [{ description: "Consultation", amount: 50 }] });
      await load(currentPage);
    } catch (err) {
      setMsg(err?.message || "Failed to create invoice.");
    } finally {
      setLoading(false);
    }
  }, [currentPage, form, load]);

  const payInvoice = useCallback(async (id, amount) => {
    setLoading(true);
    setMsg("");
    try {
      await billingService.payFinancial?.(id, amount);
      await load(currentPage);
    } catch (err) {
      setMsg(err?.message || "Failed to record payment.");
    } finally {
      setLoading(false);
    }
  }, [currentPage, load]);

  const claimInvoice = useCallback(async (id, provider) => {
    setLoading(true);
    setMsg("");
    try {
      await billingService.claimFinancial?.(id, provider);
      await load(currentPage);
    } catch (err) {
      setMsg(err?.message || "Failed to submit claim.");
    } finally {
      setLoading(false);
    }
  }, [currentPage, load]);

  const nextPage = useCallback(() => setCurrentPage((prev) => prev + 1), []);
  const prevPage = useCallback(() => setCurrentPage((prev) => Math.max(1, prev - 1)), []);

  const filteredItems = useMemo(() => items, [items]);

  return {
    items,
    filteredItems,
    total,
    loading,
    msg,
    form,
    page: currentPage,
    setForm,
    setPage: setCurrentPage,
    load,
    createInvoice,
    payInvoice,
    claimInvoice,
    nextPage,
    prevPage,
  };
}

export default useFinancials;
