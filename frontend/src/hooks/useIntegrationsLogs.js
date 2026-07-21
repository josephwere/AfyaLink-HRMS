import { useCallback, useEffect, useState } from "react";
import { fetchAuditLogs } from "../services/auditApi";

export function useIntegrationsLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchAuditLogs({ limit: 100 });
      setLogs(Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []);
    } catch (err) {
      setLogs([]);
      setError(err?.message || "Failed to load integration logs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { logs, loading, error, load };
}

export default useIntegrationsLogs;
