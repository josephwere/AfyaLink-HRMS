import { useCallback, useEffect, useState } from "react";
import { getCurrentShift, openShift, closeShift, getShift } from "../../services/finance/shiftsApi";

function isValidShift(shift) {
  if (!shift || typeof shift !== "object") return false;
  return Boolean(shift._id || shift.id || shift.shiftId);
}

function normalizeShift(shift) {
  if (!isValidShift(shift)) return null;
  return shift;
}

export default function useCashierShift() {
  const [currentShift, setCurrentShift] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getCurrentShift();
      const normalized = normalizeShift(res);
      setCurrentShift(normalized);
      return normalized;
    } catch (err) {
      // no current shift or error
      setCurrentShift(null);
      setError(err?.message || String(err));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const startShift = useCallback(async (payload) => {
    setLoading(true);
    setError(null);
    try {
      const res = await openShift(payload);
      const normalized = normalizeShift(res);
      setCurrentShift(normalized);
      // also attempt a refresh to ensure current endpoint consistency
      try {
        const ref = await refresh();
        // intentionally refresh to sync /current endpoint
      } catch (e) {
        // refresh failure is non-fatal
      }
      return res;
    } catch (err) {
      setError(err?.message || String(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const endShift = useCallback(async (id, payload) => {
    setLoading(true);
    setError(null);
    try {
      const res = await closeShift(id, payload);
      // after closing, clear current shift
      setCurrentShift(null);
      return res;
    } catch (err) {
      setError(err?.message || String(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchShift = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getShift(id);
      return res;
    } catch (err) {
      setError(err?.message || String(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  return {
    currentShift,
    loading,
    error,
    refresh,
    startShift,
    endShift,
    fetchShift,
  };
}
