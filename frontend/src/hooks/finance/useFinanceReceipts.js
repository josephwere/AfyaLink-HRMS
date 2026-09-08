import { useCallback, useState } from "react";
import { listReceipts, getReceipt } from "../../services/finance/receiptsApi";

export default function useFinanceReceipts() {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadReceipts = useCallback(async (opts = {}) => {
    setLoading(true);
    setError(null);
    try {
      const res = await listReceipts(opts);
      const rows = Array.isArray(res) ? res : res?.items || res?.receipts || [];
      setReceipts(rows);
      return rows;
    } catch (err) {
      setError(err?.message || String(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchReceipt = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      const r = await getReceipt(id);
      return r;
    } catch (err) {
      setError(err?.message || String(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    receipts,
    loading,
    error,
    loadReceipts,
    fetchReceipt,
  };
}
