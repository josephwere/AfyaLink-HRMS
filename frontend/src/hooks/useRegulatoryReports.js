import { useCallback, useState } from "react";
import { getRegulatoryAutoReport } from "../services/intelligenceApi";

export function useRegulatoryReports() {
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    setMsg("");
    try {
      const out = await getRegulatoryAutoReport();
      setData(out?.report || null);
    } catch (e) {
      setMsg(e?.message || "Failed to generate regulatory auto report");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, msg, loading, run };
}

export default useRegulatoryReports;
