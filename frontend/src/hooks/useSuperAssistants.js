import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../utils/auth";
import { normalizeRole } from "../utils/normalizeRole";
import {
  bulkUpdateSuperAssistants,
  listSuperAssistants,
  sendSuperAssistantResetLink,
  updateSuperAssistant,
} from "../services/superAdminApi";
import { listSupportTickets } from "../services/opsApi";

const coerceList = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  return [];
};

export function useSuperAssistants() {
  const { user } = useAuth();
  const actorRole = normalizeRole(user?.actualRole || user?.role);
  const canManage = actorRole === "SUPER_ADMIN" || actorRole === "SYSTEM_ADMIN";

  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    active: 0,
    disabled: 0,
    activeToday: 0,
    active7d: 0,
    neverLoggedIn: 0,
    pendingResets: 0,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [supportLoading, setSupportLoading] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [selectedRows, setSelectedRows] = useState({});
  const [supportTickets, setSupportTickets] = useState([]);
  const [supportSummary, setSupportSummary] = useState({
    open: 0,
    assigned: 0,
    escalated: 0,
    critical: 0,
    resolved: 0,
    unassigned: 0,
  });
  const [bulkAction, setBulkAction] = useState("ENABLE");
  const [bulkStatus, setBulkStatus] = useState("ACTIVE");
  const [filters, setFilters] = useState({ q: "", active: "", authProvider: "", status: "", limit: 100 });
  const [draftFilters, setDraftFilters] = useState({ q: "", active: "", authProvider: "", status: "", limit: 100 });
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "", active: true, status: "ACTIVE" });
  const tableSectionRef = useRef(null);

  const load = useCallback(
    async (nextFilters = filters, preferredId = "") => {
      if (!canManage) return;
      setLoading(true);
      setMsg("");
      try {
        const data = await listSuperAssistants(nextFilters);
        const rows = coerceList(data);
        setItems(rows);
        setSummary({
          total: Number(data?.summary?.total || rows.length || 0),
          active: Number(data?.summary?.active || rows.filter((row) => row.active).length || 0),
          disabled: Number(data?.summary?.disabled || rows.filter((row) => !row.active).length || 0),
          activeToday: Number(
            data?.summary?.activeToday || rows.filter((row) => row?.activityMetrics?.bucket === "ACTIVE_TODAY").length || 0
          ),
          active7d: Number(
            data?.summary?.active7d || rows.filter((row) => ["ACTIVE_TODAY", "ACTIVE_7D"].includes(row?.activityMetrics?.bucket)).length || 0
          ),
          neverLoggedIn: Number(
            data?.summary?.neverLoggedIn || rows.filter((row) => row?.activityMetrics?.bucket === "NEVER_LOGGED_IN").length || 0
          ),
          pendingResets: Number(data?.summary?.pendingResets || rows.filter((row) => row?.resetPasswordRequestedAt).length || 0),
        });
        setSelectedRows((prev) => {
          const next = {};
          rows.forEach((row) => {
            if (prev[String(row._id)]) next[String(row._id)] = true;
          });
          return next;
        });
        setSelectedId((current) => {
          const keepCurrent = rows.some((row) => String(row._id) === String(current));
          const targetId = preferredId || (keepCurrent ? current : rows[0]?._id || "");
          return targetId ? String(targetId) : "";
        });
      } catch (err) {
        setItems([]);
        setSummary({
          total: 0,
          active: 0,
          disabled: 0,
          activeToday: 0,
          active7d: 0,
          neverLoggedIn: 0,
          pendingResets: 0,
        });
        setSelectedRows({});
        setSelectedId("");
        setMsg(err?.message || "Unable to load super assistants right now.");
      } finally {
        setLoading(false);
      }
    },
    [filters, canManage]
  );

  const loadSupportQueue = useCallback(async () => {
    if (!canManage) return;
    setSupportLoading(true);
    setSupportMessage("");
    try {
      const data = await listSupportTickets({ limit: 24 });
      const tickets = Array.isArray(data?.tickets) ? data.tickets : [];
      setSupportTickets(tickets);
      setSupportSummary({
        open: tickets.filter((ticket) => ticket?.status === "OPEN").length,
        assigned: tickets.filter((ticket) => ticket?.status === "ASSIGNED").length,
        escalated: tickets.filter((ticket) => ticket?.status === "ESCALATED").length,
        critical: tickets.filter((ticket) => ticket?.priority === "CRITICAL" && ticket?.status !== "RESOLVED").length,
        resolved: tickets.filter((ticket) => ticket?.status === "RESOLVED").length,
        unassigned: tickets.filter((ticket) => !ticket?.assignee && ticket?.status !== "RESOLVED").length,
      });
    } catch (err) {
      setSupportTickets([]);
      setSupportSummary({ open: 0, assigned: 0, escalated: 0, critical: 0, resolved: 0, unassigned: 0 });
      setSupportMessage(err?.message || "Unable to load the support queue right now.");
    } finally {
      setSupportLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    if (!canManage) return;
    load(filters);
  }, [canManage, filters, load]);

  useEffect(() => {
    if (!canManage) return;
    loadSupportQueue();
  }, [canManage, loadSupportQueue]);

  const selected = useMemo(() => items.find((row) => String(row._id) === String(selectedId)) || null, [items, selectedId]);

  useEffect(() => {
    if (!selected) {
      setEditForm({ name: "", email: "", phone: "", active: true, status: "ACTIVE" });
      return;
    }
    setEditForm({
      name: selected.name || "",
      email: selected.email || "",
      phone: selected.phone || "",
      active: selected.active !== false,
      status: selected?.systemProfile?.status || "ACTIVE",
    });
  }, [selected]);

  const onSave = useCallback(
    async (e) => {
      e.preventDefault();
      if (!selected) return;
      setSaving(true);
      setMsg("");
      try {
        await updateSuperAssistant(selected._id, editForm);
        setMsg("Super assistant updated.");
        await load(filters, selected._id);
      } catch (err) {
        setMsg(err?.message || "Unable to save super assistant changes.");
      } finally {
        setSaving(false);
      }
    },
    [selected, editForm, filters, load]
  );

  const toggleActive = useCallback(
    async (row) => {
      setSaving(true);
      setMsg("");
      try {
        await updateSuperAssistant(row._id, {
          active: row.active === false,
          status: row.active === false ? row?.systemProfile?.status || "ACTIVE" : "SUSPENDED",
        });
        setMsg(row.active === false ? "Super assistant re-enabled." : "Super assistant disabled.");
        await load(filters, row._id);
      } catch (err) {
        setMsg(err?.message || "Unable to update assistant access.");
      } finally {
        setSaving(false);
      }
    },
    [filters, load]
  );

  const sendInviteOrReset = useCallback(
    async (row) => {
      setSaving(true);
      setMsg("");
      try {
        const res = await sendSuperAssistantResetLink(row._id);
        if (res?.resetLink && navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(res.resetLink).catch(() => {});
        }
        setMsg(
          res?.mode === "invite"
            ? "Invite link sent. The secure link was also copied if clipboard access was available."
            : "Reset link sent. The secure link was also copied if clipboard access was available."
        );
        await load(filters, row._id);
      } catch (err) {
        setMsg(err?.message || "Unable to send invite/reset link.");
      } finally {
        setSaving(false);
      }
    },
    [filters, load]
  );

  const applyBulkAction = useCallback(async () => {
    const ids = Object.entries(selectedRows).filter(([, checked]) => checked).map(([id]) => id);
    if (!ids.length) {
      setMsg("Select at least one super assistant.");
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      const payload = { ids, action: bulkAction, ...(bulkAction === "SET_STATUS" ? { status: bulkStatus } : {}) };
      const res = await bulkUpdateSuperAssistants(payload);
      setMsg(res?.msg || "Bulk action completed.");
      await load(filters, selectedId);
    } catch (err) {
      setMsg(err?.message || "Unable to run bulk action.");
    } finally {
      setSaving(false);
    }
  }, [bulkAction, bulkStatus, selectedRows, filters, selectedId, load]);

  const toggleRowSelection = useCallback((id) => {
    setSelectedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const allVisibleSelected = items.length > 0 && items.every((row) => selectedRows[String(row._id)]);

  const focusManagementTable = useCallback(() => {
    tableSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const openSupportTickets = useCallback((navigate, params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value == null || value === "") return;
      query.set(key, String(value));
    });
    const suffix = query.toString() ? `?${query.toString()}` : "";
    navigate(`/app/platform/support/tickets${suffix}`);
  }, []);

  const applySummaryView = useCallback((kind) => {
    if (kind === "total") {
      const reset = { q: "", active: "", authProvider: "", status: "", limit: 100 };
      setDraftFilters(reset);
      setFilters(reset);
      focusManagementTable();
      return;
    }
    if (kind === "active") {
      const next = { ...draftFilters, active: "true" };
      setDraftFilters(next);
      setFilters(next);
      focusManagementTable();
      return;
    }
    if (kind === "disabled") {
      const next = { ...draftFilters, active: "false" };
      setDraftFilters(next);
      setFilters(next);
      focusManagementTable();
      return;
    }

    const matcher =
      kind === "activeToday"
        ? (row) => row?.activityMetrics?.bucket === "ACTIVE_TODAY"
        : kind === "active7d"
        ? (row) => ["ACTIVE_TODAY", "ACTIVE_7D"].includes(row?.activityMetrics?.bucket)
        : kind === "never"
        ? (row) => row?.activityMetrics?.bucket === "NEVER_LOGGED_IN"
        : (row) => Boolean(row?.resetPasswordRequestedAt);

    const match = items.find(matcher);
    if (match?._id) {
      setSelectedId(String(match._id));
      focusManagementTable();
      return;
    }
    setMsg("No assistants in this category for the current result set.");
    focusManagementTable();
  }, [draftFilters, items, focusManagementTable]);

  return {
    canManage,
    items,
    summary,
    loading,
    saving,
    msg,
    supportMessage,
    supportLoading,
    selectedId,
    setSelectedId,
    selectedRows,
    setSelectedRows,
    supportTickets,
    supportSummary,
    bulkAction,
    setBulkAction,
    bulkStatus,
    setBulkStatus,
    filters,
    setFilters,
    draftFilters,
    setDraftFilters,
    editForm,
    setEditForm,
    tableSectionRef,
    load,
    loadSupportQueue,
    onSave,
    toggleActive,
    sendInviteOrReset,
    applyBulkAction,
    toggleRowSelection,
    allVisibleSelected,
    focusManagementTable,
    openSupportTickets,
    applySummaryView,
  };
}

export default useSuperAssistants;
