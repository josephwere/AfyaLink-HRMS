import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../utils/auth";
import { normalizeRole } from "../utils/normalizeRole";
import { apiFetch } from "../utils/apiFetch";
import { getClinicalOrderCopilotSnapshot, getDigitalHospitalTwinSnapshot, getInteropMarketplaceSnapshot } from "../services/platformInnovationApi";

export function useInnovationSnapshot({ kind = "clinical-order-copilot" } = {}) {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const actorRole = normalizeRole(user?.actualRole || user?.role);
  const canSwitchHospital = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(actorRole);
  const [hospitalId, setHospitalId] = useState(() => searchParams.get("hospitalId") || "");
  const [snapshot, setSnapshot] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [clientMeta, setClientMeta] = useState(null);
  const requestRef = useRef(0);

  useEffect(() => {
    if (!canSwitchHospital) return;
    apiFetch("/api/hospitals/marketplace?limit=200")
      .then((res) => setHospitals(Array.isArray(res?.items) ? res.items : []))
      .catch(() => setHospitals([]));
  }, [canSwitchHospital]);

  const loadSnapshot = useCallback(
    async ({ preserveSnapshot = false } = {}) => {
      const requestId = requestRef.current + 1;
      requestRef.current = requestId;
      setLoading(true);
      setMsg("");
      try {
        const result =
          kind === "digital-twin"
            ? await getDigitalHospitalTwinSnapshot({ hospitalId: hospitalId || undefined })
            : kind === "interop-marketplace"
            ? await getInteropMarketplaceSnapshot({ hospitalId: hospitalId || undefined })
            : await getClinicalOrderCopilotSnapshot({ hospitalId: hospitalId || undefined });
        if (requestRef.current !== requestId) return;
        setSnapshot(result?.payload || null);
        setClientMeta(result?.clientMeta || null);
      } catch (err) {
        if (requestRef.current !== requestId) return;
        if (!preserveSnapshot) setSnapshot(null);
        setMsg(err?.message || "We could not load the snapshot yet. Try again in a moment.");
      } finally {
        if (requestRef.current === requestId) setLoading(false);
      }
    },
    [hospitalId, kind]
  );

  useEffect(() => {
    loadSnapshot({ preserveSnapshot: false });
  }, [loadSnapshot]);

  const handleHospitalChange = (nextValue) => {
    setHospitalId(nextValue);
    setSearchParams(nextValue ? { hospitalId: nextValue } : {});
  };

  const hasSnapshot = Boolean(snapshot);
  const initialLoading = loading && !hasSnapshot;
  const refreshing = loading && hasSnapshot;

  return {
    actorRole,
    canSwitchHospital,
    hospitalId,
    handleHospitalChange,
    snapshot,
    hospitals,
    loading,
    msg,
    clientMeta,
    loadSnapshot,
    hasSnapshot,
    initialLoading,
    refreshing,
  };
}

export default useInnovationSnapshot;
