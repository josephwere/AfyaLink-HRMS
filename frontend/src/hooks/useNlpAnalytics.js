import { useCallback, useState } from "react";
import { queryNlpAnalytics } from "../services/intelligenceApi";

export function useNlpAnalytics(initialQuery = "Show pending approvals this week") {
  const [query, setQuery] = useState(initialQuery);
  const [result, setResult] = useState(null);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    setMsg("");
    setResult(null);
    try {
      const out = await queryNlpAnalytics(query);
      setResult(out || null);
    } catch (e) {
      setMsg(e?.message || "Failed to run NLP analytics query");
    } finally {
      setLoading(false);
    }
  }, [query]);

  return { query, setQuery, result, msg, loading, run };
}

export default useNlpAnalytics;
