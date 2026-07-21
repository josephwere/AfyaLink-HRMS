import { useEffect, useMemo, useState } from "react";
import { listDlqItems, retryDlqItem } from "../services/dlqApi";

export function useDeveloperOps() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const data = await listDlqItems();
      const filtered = (Array.isArray(data) ? data : []).filter((item) => item?.data?.connectorId || item?.data?.payload);
      setItems(filtered);
    } catch {
      setItems([]);
      setMsg("Failed to load webhook recovery queue.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const summary = useMemo(() => {
    const uniqueConnectors = new Set(items.map((item) => item?.data?.connectorId).filter(Boolean));
    const highAttempt = items.filter((item) => Number(item.attemptsMade || 0) >= 3).length;
    return {
      uniqueConnectors: uniqueConnectors.size,
      highAttempt,
      replayable: items.filter((item) => Number(item.attemptsMade || 0) < 10).length,
    };
  }, [items]);

  const connectorLeaders = useMemo(() => {
    const counts = new Map();
    items.forEach((item) => {
      const key = item?.data?.connectorId || "unknown";
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([connector, count]) => ({ connector, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [items]);

  const replay = async (id) => {
    await retryDlqItem(id);
    await load();
  };

  return { items, loading, msg, summary, connectorLeaders, load, replay };
}

export default useDeveloperOps;
