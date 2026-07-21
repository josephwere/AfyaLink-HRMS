import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  createSupportTicket,
  exportSupportTicketsCsv,
  listSupportTickets,
  updateSupportTicket,
} from "../services/opsApi";

export function useSupportTickets({ searchParams, user }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [q, setQ] = useState(() => searchParams.get("q") || "");
  const highlightedTicketId = searchParams.get("ticketId") || "";
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "OTHER",
    priority: "MEDIUM",
    linkedIncident: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const data = await listSupportTickets({ q, status, priority, limit: 120 });
      setTickets(Array.isArray(data?.tickets) ? data.tickets : []);
    } catch (err) {
      setMessage(err?.message || "Failed to load support tickets.");
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [priority, q, status]);

  useEffect(() => {
    const t = setTimeout(() => {
      void load();
    }, 250);
    return () => clearTimeout(t);
  }, [load]);

  const submit = useCallback(async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setMessage("Title is required.");
      return;
    }
    setBusyId("create");
    setMessage("");
    try {
      await createSupportTicket({
        ...form,
        linkedIncident: form.linkedIncident || undefined,
      });
      setForm((p) => ({ ...p, title: "", description: "", linkedIncident: "" }));
      await load();
      setMessage("Support ticket created.");
    } catch (err) {
      setMessage(err?.message || "Failed to create support ticket.");
    } finally {
      setBusyId("");
    }
  }, [form, load]);

  const updateTicket = useCallback(async (ticket, payload) => {
    setBusyId(ticket._id);
    setMessage("");
    try {
      await updateSupportTicket(ticket._id, payload);
      await load();
    } catch (err) {
      setMessage(err?.message || "Failed to update ticket.");
    } finally {
      setBusyId("");
    }
  }, [load]);

  const exportCsv = useCallback(async () => {
    try {
      await exportSupportTicketsCsv({
        q: q || undefined,
        status: status || undefined,
        priority: priority || undefined,
        limit: 10000,
      });
    } catch (err) {
      setMessage(err?.message || "Failed to export support tickets CSV.");
    }
  }, [priority, q, status]);

  return {
    tickets,
    loading,
    busyId,
    message,
    q,
    setQ,
    status,
    setStatus,
    priority,
    setPriority,
    form,
    setForm,
    highlightedTicketId,
    load,
    submit,
    updateTicket,
    exportCsv,
  };
}

export default useSupportTickets;
