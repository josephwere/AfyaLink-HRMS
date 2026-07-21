import { useCallback, useEffect, useState } from "react";
import { fetchAuditLogs, fetchEvidenceBundle } from "../services/auditApi";

export function useAuditLogs(initialFilters = {}) {
  const [logs, setLogs] = useState([]);
  const [filters, setFilters] = useState(initialFilters);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (nextFilters = filters) => {
    setLoading(true);
    try {
      const res = await fetchAuditLogs(nextFilters);
      const items = Array.isArray(res)
        ? res
        : Array.isArray(res?.items)
        ? res.items
        : Array.isArray(res?.data)
        ? res.data
        : [];
      setLogs(items);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  const exportCSV = useCallback(() => {
    const rows = logs.map((l) => ({
      time: new Date(l.createdAt).toISOString(),
      actor: l.actorId?.email,
      action: l.action,
      resource: l.resource,
      success: l.success,
      ip: l.ip,
    }));

    const csv =
      "time,actor,action,resource,success,ip\n" +
      rows.map((r) => Object.values(r).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "audit-logs.csv";
    a.click();
  }, [logs]);

  const exportEvidenceBundle = useCallback(async () => {
    const data = await fetchEvidenceBundle(filters);
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "audit-evidence-bundle.json";
    a.click();
  }, [filters]);

  return {
    logs,
    filters,
    setFilters,
    loading,
    load,
    exportCSV,
    exportEvidenceBundle,
  };
}

export default useAuditLogs;
