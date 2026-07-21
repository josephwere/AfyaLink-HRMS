import { useEffect, useMemo, useState } from "react";
import { listAiAdminLogs } from "../services/aiAdminApi";

const ACTION_OPTIONS = [
  "AI_DOCUMENT_EXTRACTED",
  "AI_DOCUMENT_EXTRACTION_FAILED",
  "AI_DIGITAL_TWIN_RUN",
];

export function useAIExtractionHistory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [filters, setFilters] = useState({
    action: "AI_DOCUMENT_EXTRACTED",
    hospital: "",
    limit: 100,
  });
  const [search, setSearch] = useState("");

  const load = async (nextFilters = filters) => {
    setLoading(true);
    setMsg("");
    try {
      const data = await listAiAdminLogs(nextFilters);
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      setMsg(e?.message || "Failed to load extraction history");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleItems = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    if (!q) return items;
    return items.filter((row) => {
      const actor = `${row.actor?.name || ""} ${row.actor?.email || ""}`.toLowerCase();
      const filename = String(row.metadata?.filename || "").toLowerCase();
      const mimeType = String(row.metadata?.mimeType || "").toLowerCase();
      const provider = String(row.metadata?.provider || "").toLowerCase();
      return actor.includes(q) || filename.includes(q) || mimeType.includes(q) || provider.includes(q);
    });
  }, [items, search]);

  return {
    ACTION_OPTIONS,
    items,
    loading,
    msg,
    filters,
    setFilters,
    search,
    setSearch,
    load,
    visibleItems,
  };
}

export default useAIExtractionHistory;
