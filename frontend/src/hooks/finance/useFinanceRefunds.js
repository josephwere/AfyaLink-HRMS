// Minimal refunds hook scaffold. Expand as backend capabilities are integrated.
import { useCallback, useState } from "react";

export default function useFinanceRefunds({ api } = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const createRefund = useCallback(async (payload) => {
    setLoading(true);
    setError(null);
    try {
      if (!api || typeof api.createRefund !== "function") {
        throw new Error("Refund API not available");
      }
      const res = await api.createRefund(payload);
      return res;
    } catch (err) {
      setError(err?.message || String(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [api]);

  return { createRefund, loading, error };
}
