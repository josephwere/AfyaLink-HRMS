import { useCallback, useEffect, useMemo, useState } from "react";
import { listConnectorAnalytics } from "../services/connectorsApi";

export function useConnectorAnalytics() {
  const [data, setData] = useState([]);

  const load = useCallback(async () => {
    try {
      const js = await listConnectorAnalytics();
      setData(Array.isArray(js) ? js : Array.isArray(js?.items) ? js.items : []);
    } catch {
      setData([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => ({
    connectors: data.length,
    healthy: data.filter((item) => Number(item?.lastSync || 0) > 0).length,
  }), [data]);

  return { data, load, summary };
}

export default useConnectorAnalytics;
