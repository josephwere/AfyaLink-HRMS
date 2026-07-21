import { useCallback, useEffect, useState } from "react";
import {
  ackSreIncident,
  createSreIncident,
  exportSreIncidentsCsv,
  escalateSreIncident,
  listSreIncidents,
  mitigateSreIncident,
  resolveSreIncident,
} from "../services/opsApi";

export function useSreIncidentOps() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [severity, setSeverity] = useState("");
  const [form, setForm] = useState({
    severity: "SEV2",
    summary: "",
    sourceAlert: "",
    service: "AfyaLink",
    runbookUrl: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const data = await listSreIncidents({ q, status, severity, limit: 120 });
      setItems(Array.isArray(data?.incidents) ? data.incidents : []);
    } catch (err) {
      setMessage(err?.message || "Failed to load incidents.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [q, severity, status]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const submit = useCallback(async (e) => {
    e.preventDefault();
    if (!form.summary.trim()) {
      setMessage("Summary is required.");
      return;
    }
    setBusyId("create");
    setMessage("");
    try {
      await createSreIncident(form);
      setForm((prev) => ({ ...prev, summary: "", sourceAlert: "" }));
      await load();
      setMessage("Incident declared.");
    } catch (err) {
      setMessage(err?.message || "Failed to create incident.");
    } finally {
      setBusyId("");
    }
  }, [form, load]);

  const runAction = useCallback(async (id, fn, note) => {
    setBusyId(id);
    setMessage("");
    try {
      await fn(id, { note });
      await load();
    } catch (err) {
      setMessage(err?.message || "Incident action failed.");
    } finally {
      setBusyId("");
    }
  }, [load]);

  const ackIncident = useCallback(async (id, note = "Acknowledged by operations") => {
    await runAction(id, ackSreIncident, note);
  }, [runAction]);

  const escalateIncident = useCallback(async (id, note = "Escalated") => {
    await runAction(id, escalateSreIncident, note);
  }, [runAction]);

  const mitigateIncident = useCallback(async (id, note = "Mitigation applied") => {
    await runAction(id, mitigateSreIncident, note);
  }, [runAction]);

  const resolveIncident = useCallback(async (id, note = "Resolved") => {
    await runAction(id, resolveSreIncident, note);
  }, [runAction]);

  const exportCsv = useCallback(async () => {
    try {
      await exportSreIncidentsCsv({
        q: q || undefined,
        status: status || undefined,
        severity: severity || undefined,
        limit: 10000,
      });
    } catch (err) {
      setMessage(err?.message || "Failed to export incidents CSV.");
    }
  }, [q, severity, status]);

  return {
    items,
    loading,
    busyId,
    message,
    q,
    setQ,
    status,
    setStatus,
    severity,
    setSeverity,
    form,
    setForm,
    load,
    submit,
    runAction,
    ackIncident,
    escalateIncident,
    mitigateIncident,
    resolveIncident,
    exportCsv,
  };
}

export default useSreIncidentOps;
