import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getIntegrationHubSummary } from "../services/systemAdminApi";

function statusTone(status) {
  if (status === "READY") return "good";
  if (status === "AT_RISK") return "warn";
  if (status === "DEGRADED") return "risk";
  if (status === "DISABLED") return "warn";
  return "muted";
}

export function useIntegrationHub() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [clientMeta, setClientMeta] = useState(null);
  const prioritySectionRef = useRef(null);
  const inventorySectionRef = useRef(null);
  const requestRef = useRef(0);

  const scrollToSection = useCallback((ref) => {
    ref?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const load = useCallback(async ({ preserveData = false } = {}) => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setLoading(true);
    setError("");
    try {
      const res = await getIntegrationHubSummary();
      if (requestRef.current !== requestId) return;
      setData(res?.payload || null);
      setClientMeta(res?.clientMeta || null);
    } catch (err) {
      if (requestRef.current !== requestId) return;
      setError(err?.message || "Failed to load integration hub");
      if (!preserveData) setData(null);
    } finally {
      if (requestRef.current === requestId) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load({ preserveData: false });
  }, [load]);

  const hasData = Boolean(data);
  const initialLoading = loading && !hasData;
  const refreshing = loading && hasData;

  const modules = Array.isArray(data?.modules) ? data.modules : [];
  const connectors = Array.isArray(data?.connectors) ? data.connectors : [];
  const freeApis = Array.isArray(data?.freeApis) ? data.freeApis : [];

  const topActions = useMemo(
    () => [
      { label: "Connector Runtime", to: "/system-admin/connector-sdk" },
      { label: "Mapping Studio", to: "/system-admin/mapping-studio" },
      { label: "Integration Monitor", to: "/admin/realtime" },
      { label: "Migration Hub", to: "/system-admin/migrations" },
      { label: "Offline Ops", to: "/admin/offline-ops" },
    ],
    []
  );

  return {
    navigate,
    data,
    loading,
    error,
    clientMeta,
    prioritySectionRef,
    inventorySectionRef,
    scrollToSection,
    load,
    hasData,
    initialLoading,
    refreshing,
    modules,
    connectors,
    freeApis,
    topActions,
    statusTone,
  };
}

export default useIntegrationHub;
