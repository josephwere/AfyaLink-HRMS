import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCountyCommandCenterSummary } from "../services/systemAdminApi";

export function useCountyCommandCenter() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [clientMeta, setClientMeta] = useState(null);
  const [region, setRegion] = useState("");
  const requestRef = useRef(0);

  const load = useCallback(async (selectedRegion = region, { preserveData = false } = {}) => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setLoading(true);
    setError("");
    try {
      const res = await getCountyCommandCenterSummary({ region: selectedRegion });
      if (requestRef.current !== requestId) return;
      setData(res?.payload || null);
      setClientMeta(res?.clientMeta || null);
    } catch (err) {
      if (requestRef.current !== requestId) return;
      setError(err?.message || "Failed to load county command center");
      if (!preserveData) setData(null);
    } finally {
      if (requestRef.current === requestId) setLoading(false);
    }
  }, [region]);

  useEffect(() => {
    void load("", { preserveData: false });
  }, [load]);

  const regions = Array.isArray(data?.regions) ? data.regions : [];
  const regionOptions = useMemo(() => {
    if (Array.isArray(data?.allRegions) && data.allRegions.length) return data.allRegions;
    return regions.map((row) => row.region);
  }, [data, regions]);

  const hasData = Boolean(data);
  const initialLoading = loading && !hasData;
  const refreshing = loading && hasData;

  return {
    data,
    loading,
    error,
    clientMeta,
    region,
    setRegion,
    load,
    regions,
    regionOptions,
    hasData,
    initialLoading,
    refreshing,
  };
}

export default useCountyCommandCenter;
