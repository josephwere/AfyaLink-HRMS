import { useCallback, useEffect, useMemo, useState } from "react";
import { createLabOpsRecord, listLabOpsRecords } from "../services/labOpsApi";

export function useLabOps({ kind = "", limit = 80, initialForm = {} } = {}) {
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState(initialForm);

  const loadRecords = useCallback(async () => {
    try {
      const data = await listLabOpsRecords({ kind, limit });
      setRecords(Array.isArray(data?.items) ? data.items : []);
      setTotal(Number(data?.total || 0));
      setMessage("");
    } catch (err) {
      setRecords([]);
      setTotal(0);
      setMessage(err?.message || "Unable to load records.");
    } finally {
      setLoading(false);
    }
  }, [kind, limit]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const sorted = useMemo(
    () =>
      [...records].sort((a, b) => {
        const aTime = new Date(b.observedAt || b.createdAt).getTime();
        const bTime = new Date(a.observedAt || a.createdAt).getTime();
        return aTime - bTime;
      }),
    [records]
  );

  const createRecord = useCallback(async (payload) => {
    setBusy(true);
    try {
      await createLabOpsRecord(payload);
      setForm(initialForm);
      await loadRecords();
      setMessage("Record saved.");
      return true;
    } catch (err) {
      setMessage(err?.message || "Unable to save the record.");
      return false;
    } finally {
      setBusy(false);
    }
  }, [initialForm, loadRecords]);

  return {
    records,
    sorted,
    total,
    loading,
    busy,
    message,
    setMessage,
    form,
    setForm,
    loadRecords,
    createRecord,
  };
}

export default useLabOps;
