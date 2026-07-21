import { useEffect, useMemo, useState } from "react";
import { listDlqItems, retryDlqItem, updateDlqItem } from "../services/dlqApi";
import { listBackgroundJobs, retryBackgroundJob } from "../services/backgroundJobsApi";

export function useQueueReplay() {
  const [items, setItems] = useState([]);
  const [backgroundJobs, setBackgroundJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [selected, setSelected] = useState(null);
  const [payload, setPayload] = useState("");

  const load = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const [data, jobs] = await Promise.all([listDlqItems(), listBackgroundJobs({ limit: 30 })]);
      setItems(Array.isArray(data) ? data : []);
      setBackgroundJobs(Array.isArray(jobs?.items) ? jobs.items : []);
    } catch {
      setItems([]);
      setBackgroundJobs([]);
      setMsg("Failed to load DLQ items");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openEditor = (job) => {
    setSelected(job);
    setPayload(JSON.stringify(job.data || {}, null, 2));
  };

  const savePayload = async (replay = false) => {
    if (!selected) return;
    try {
      const parsed = JSON.parse(payload);
      await updateDlqItem(selected.id, parsed);
      if (replay) {
        await retryDlqItem(selected.id);
      }
      setMsg("Payload updated.");
      setSelected(null);
      await load();
    } catch {
      setMsg("Invalid JSON payload");
    }
  };

  const summary = useMemo(() => {
    const failedJobs = backgroundJobs.filter((job) => ["FAILED", "DEAD_LETTER"].includes(job.status)).length;
    const replayReady = items.filter((item) => Number(item.attemptsMade || 0) < 10).length;
    const connectors = new Set(items.map((item) => item?.data?.connectorId).filter(Boolean)).size;
    return { failedJobs, replayReady, connectors };
  }, [backgroundJobs, items]);

  const replayBackgroundJob = async (jobId) => {
    await retryBackgroundJob(jobId);
    await load();
  };

  return {
    items,
    backgroundJobs,
    loading,
    msg,
    selected,
    payload,
    setPayload,
    setSelected,
    load,
    openEditor,
    savePayload,
    summary,
    replayBackgroundJob,
  };
}

export default useQueueReplay;
