import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../utils/auth";
import { useSocket } from "../utils/socket";
import { chatAssistant } from "../services/assistantApi";
import { updateSupportTicket } from "../services/opsApi";
import {
  getUnifiedAssistantOverview,
  searchUnifiedAssistant,
  getUnifiedAssistantRecord,
  getUnifiedAssistantSettings,
  updateUnifiedAssistantSettings,
  logUnifiedAssistantHandoff,
  listAssistantMessages,
  sendAssistantMessage,
} from "../services/unifiedAssistantApi";
import apiFetch from "../utils/apiFetch";

const MODE_OPTIONS = ["ASSIST", "AUTO", "TAKEOVER"];
const AVAILABILITY_OPTIONS = ["AVAILABLE", "BUSY", "AWAY", "OFFLINE"];

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "—";
  }
}

function formatMoney(currency = "KES", amount = 0) {
  return `${currency} ${Number(amount || 0).toLocaleString()}`;
}

function patientName(patient) {
  if (!patient) return "Patient";
  const full = [patient.firstName, patient.lastName].filter(Boolean).join(" ").trim();
  return full || patient.name || patient.nationalId || patient.countryId || "Patient";
}

function userName(user) {
  if (!user) return "User";
  return user.name || user.email || user.phone || user.role || "User";
}

function badgeClass(value = "") {
  const t = String(value || "").toUpperCase();
  if (["CRITICAL", "HIGH", "ESCALATED", "REJECTED", "TERMINATED", "VOID"].includes(t)) return "risk";
  if (["MEDIUM", "REVIEW_REQUIRED", "SUBMITTED", "ASSIGNED", "REQUESTED", "UNPAID", "PAST_DUE"].includes(t)) return "warn";
  return "good";
}

function formatModeLabel(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/(^|_)([a-z])/g, (_, prefix, chr) => `${prefix ? " " : ""}${chr.toUpperCase()}`)
    .trim();
}

function formatAvailabilityLabel(value = "") {
  return formatModeLabel(value);
}

function scalarText(value) {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value instanceof Date) return formatDate(value);
  if (Array.isArray(value)) {
    const rendered = value.map((item) => scalarText(item)).filter((item) => item && item !== "—");
    return rendered.length ? rendered.join(", ") : "—";
  }
  if (typeof value === "object") {
    const entries = Object.entries(value)
      .map(([key, item]) => `${key}: ${scalarText(item)}`)
      .filter((item) => item && !item.endsWith(": —"));
    return entries.length ? entries.join(" • ") : "—";
  }
  return String(value);
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function buildSelectionRecord(selection, recordData) {
  if (!selection) return null;
  if (selection.type === "record") return recordData?.record || null;
  if (selection.type === "ticket") return recordData?.record || selection.item || null;
  if (selection.type === "call") return recordData?.record || selection.item || null;
  if (selection.type === "alert") return recordData?.record || selection.item || null;
  return selection.item || null;
}

function currentEntityContext(selection, recordData) {
  if (!selection) return { kind: "", id: "" };
  if (selection.type === "record") {
    return {
      kind: selection.item?.kind || recordData?.kind || "",
      id: selection.item?.id || recordData?.record?._id || "",
    };
  }
  if (selection.type === "ticket") return { kind: "ticket", id: recordData?.record?._id || selection.item?._id || "" };
  if (selection.type === "call") return { kind: "call", id: recordData?.record?._id || selection.item?._id || "" };
  if (selection.type === "alert") {
    return {
      kind: selection.item?.entityKind || "alert",
      id: selection.item?.entityId || selection.item?.id || "",
    };
  }
  if (selection.type === "channel") return { kind: "channel", id: selection.item?._id || "" };
  return { kind: "", id: "" };
}

function buildAiPrompt(selection, recordData, workspaceSettings) {
  const record = buildSelectionRecord(selection, recordData);
  const label = selection?.type === "channel"
    ? `communication channel ${selection.item?.name || "channel"}`
    : selection?.type === "ticket"
      ? `support ticket ${record?.ticketKey || record?.title || "ticket"}`
      : selection?.type === "call"
        ? `call session ${record?._id || "call"}`
        : selection?.type === "alert"
          ? `alert ${selection.item?.title || "alert"}`
          : `${selection?.item?.kind || "record"} ${record?._id || ""}`;

  return [
    "You are the AfyaLink Unified Assistant copilot.",
    "Draft a concise support response and next action plan.",
    "Return plain text only.",
    `Current workspace item: ${label}.`,
    `Workspace mode: ${workspaceSettings?.operatingMode || "ASSIST"}.`,
    `Human availability: ${workspaceSettings?.humanAvailability?.status || "AVAILABLE"}.`,
    `Context JSON: ${JSON.stringify({ selection, record: recordData }, null, 2)}`,
  ].join("\n");
}

function buildRouteWithParams(path, params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    qs.set(key, String(value));
  });
  const suffix = qs.toString();
  return suffix ? `${path}?${suffix}` : path;
}

function resolveUnifiedRecordPath(kind, record) {
  switch (String(kind || "").toLowerCase()) {
    case "patient":
      return buildRouteWithParams("/patients/overview", { patientId: record?._id || record?.id });
    case "hospital":
      return buildRouteWithParams("/system-admin/hospitals", { hospitalId: record?._id || record?.id });
    case "claim":
      return buildRouteWithParams("/claims/overview", { claimId: record?._id || record?.id });
    case "invoice":
      return buildRouteWithParams("/invoices/overview", { invoiceId: record?._id || record?.id });
    case "ticket":
      return buildRouteWithParams("/app/platform/support/tickets", { ticketId: record?._id || record?.id });
    case "user":
      return buildRouteWithParams("/hospital-admin/staff", { userId: record?._id || record?.id });
    case "audit":
      return buildRouteWithParams("/admin/audit-logs", { auditId: record?._id || record?.id });
    default:
      return "";
  }
}

export function useUnifiedAssistantDashboard() {
  const navigate = useNavigate();
  const socket = useSocket();
  const { user } = useAuth();
  const searchInputRef = useRef(null);
  const messageScrollerRef = useRef(null);

  const [hospitalScope, setHospitalScope] = useState("");
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [selection, setSelection] = useState(null);
  const [recordData, setRecordData] = useState(null);
  const [recordLoading, setRecordLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchMsg, setSearchMsg] = useState("");
  const [channelMessages, setChannelMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [draft, setDraft] = useState("");
  const [ticketNote, setTicketNote] = useState("");
  const [ticketSaving, setTicketSaving] = useState(false);
  const [aiDraft, setAiDraft] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [surfaceFilter, setSurfaceFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [refreshTick, setRefreshTick] = useState(0);
  const [workspaceSettings, setWorkspaceSettings] = useState(null);
  const [handoffLogs, setHandoffLogs] = useState([]);
  const [modeDraft, setModeDraft] = useState("ASSIST");
  const [availabilityDraft, setAvailabilityDraft] = useState("AVAILABLE");
  const [handoffNote, setHandoffNote] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [handoffSaving, setHandoffSaving] = useState(false);
  const [activeConsultationCall, setActiveConsultationCall] = useState(null);
  const [callActionLoading, setCallActionLoading] = useState("");

  const role = String(user?.role || "").toUpperCase();
  const canOpenConsultationMonitor = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role);
  const canOpenFinancials = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role);
  const canOpenFraudGuard = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role);
  const canOpenDeveloper = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role);
  const canRouteOutsideWorkspace = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role);
  const canBlockCalls = ["SUPER_ASSISTANT", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role);
  const canOperateCalls = ["SUPER_ASSISTANT", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN"].includes(role);
  const consultationRoomRole = role === "PATIENT" ? "PATIENT" : "DOCTOR";
  const isGlobal = Boolean(overview?.scope?.global);

  const syncWorkspaceState = (settings, logs) => {
    const nextSettings = settings || null;
    setWorkspaceSettings(nextSettings);
    setHandoffLogs(safeArray(logs));
    setModeDraft(nextSettings?.operatingMode || "ASSIST");
    setAvailabilityDraft(nextSettings?.humanAvailability?.status || "AVAILABLE");
    setHandoffNote((current) => (current.trim() ? current : nextSettings?.humanAvailability?.note || ""));
  };

  const loadOverview = async () => {
    setLoading(true);
    setMessage("");
    try {
      const data = await getUnifiedAssistantOverview({ hospitalId: hospitalScope || undefined });
      setOverview(data || null);
      syncWorkspaceState(data?.assistantWorkspace || null, data?.assistantHandoffLogs || []);
      const preferredSelection =
        selection && selection.type !== "channel"
          ? selection
          : data?.channels?.[0]
            ? { type: "channel", item: data.channels[0] }
            : data?.tickets?.[0]
              ? { type: "ticket", item: data.tickets[0] }
              : data?.calls?.[0]
                ? { type: "call", item: data.calls[0] }
                : data?.alerts?.[0]
                  ? { type: "alert", item: data.alerts[0] }
                  : null;
      if (!selection && preferredSelection) setSelection(preferredSelection);
    } catch (err) {
      setOverview(null);
      setMessage(err?.message || "Failed to load unified assistant workspace.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOverview();
  }, [hospitalScope, refreshTick]);

  useEffect(() => {
    if (!selection) {
      setRecordData(null);
      return;
    }

    const supportedKinds = new Set(["patient", "hospital", "claim", "ticket", "call", "user", "audit", "invoice"]);
    let kind = null;
    let id = null;

    if (selection.type === "record") {
      kind = selection.item?.kind;
      id = selection.item?.id;
    } else if (selection.type === "ticket") {
      kind = "ticket";
      id = selection.item?._id;
    } else if (selection.type === "call") {
      kind = "call";
      id = selection.item?._id;
    } else if (selection.type === "alert") {
      kind = selection.item?.entityKind;
      id = selection.item?.entityId;
    }

    if (!kind || !id || !supportedKinds.has(kind)) {
      setRecordData(null);
      return;
    }

    let cancelled = false;
    setRecordLoading(true);
    getUnifiedAssistantRecord({ kind, id, hospitalId: hospitalScope || undefined })
      .then((data) => {
        if (!cancelled) setRecordData(data || null);
      })
      .catch((err) => {
        if (!cancelled) {
          setRecordData(null);
          setMessage(err?.message || "Failed to load selected record.");
        }
      })
      .finally(() => {
        if (!cancelled) setRecordLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selection, hospitalScope]);

  useEffect(() => {
    if (selection?.type !== "call") {
      setActiveConsultationCall(null);
    }
  }, [selection?.type]);

  const activeChannelId = selection?.type === "channel" ? selection.item?._id : "";

  const loadMessages = async (channelId, cursor = "", append = false) => {
    if (!channelId) {
      setChannelMessages([]);
      setNextCursor(null);
      return;
    }
    setMessagesLoading(true);
    try {
      const data = await listAssistantMessages({ channelId, cursor, limit: 30 });
      const rows = Array.isArray(data?.items) ? [...data.items].reverse() : [];
      setNextCursor(data?.nextCursor || null);
      setChannelMessages((prev) => (append ? [...rows, ...prev] : rows));
    } catch (err) {
      setChannelMessages([]);
      setNextCursor(null);
      setMessage(err?.message || "Failed to load channel messages.");
    } finally {
      setMessagesLoading(false);
    }
  };

  useEffect(() => {
    if (!activeChannelId) {
      setChannelMessages([]);
      setNextCursor(null);
      return;
    }
    void loadMessages(activeChannelId);
  }, [activeChannelId]);

  useEffect(() => {
    if (!socket || !activeChannelId) return;
    socket.emit("communication:join", { channelId: activeChannelId });
    const onMsg = (incoming) => {
      if (String(incoming?.channel) !== String(activeChannelId)) return;
      setChannelMessages((prev) => {
        if (prev.some((item) => String(item._id) === String(incoming._id))) return prev;
        return [...prev, incoming];
      });
      setOverview((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          channels: Array.isArray(prev.channels)
            ? prev.channels.map((channel) =>
                String(channel._id) === String(activeChannelId)
                  ? {
                      ...channel,
                      lastMessage: {
                        body: incoming.body,
                        senderRole: incoming.senderRole,
                        createdAt: incoming.createdAt,
                      },
                    }
                  : channel
              )
            : prev.channels,
        };
      });
    };
    socket.on("communication:message", onMsg);
    return () => {
      socket.emit("communication:leave", { channelId: activeChannelId });
      socket.off("communication:message", onMsg);
    };
  }, [socket, activeChannelId]);

  useEffect(() => {
    if (!messageScrollerRef.current) return;
    messageScrollerRef.current.scrollTop = messageScrollerRef.current.scrollHeight;
  }, [channelMessages, aiDraft, selection]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchResults([]);
      setSearchMsg("");
      return;
    }
    const timer = setTimeout(() => {
      setSearching(true);
      searchUnifiedAssistant({ q: query, hospitalId: hospitalScope || undefined, limit: 6 })
        .then((data) => {
          const items = Array.isArray(data?.items) ? data.items : [];
          setSearchResults(items);
          setSearchMsg(items.length ? "" : "No records found.");
        })
        .catch((err) => {
          setSearchResults([]);
          setSearchMsg(err?.message || "Search failed.");
        })
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, hospitalScope]);

  const filteredTickets = useMemo(() => {
    const rows = Array.isArray(overview?.tickets) ? overview.tickets : [];
    return rows.filter((ticket) => {
      if (surfaceFilter !== "ALL" && String(ticket.status || "") !== surfaceFilter) return false;
      if (priorityFilter !== "ALL" && String(ticket.priority || "") !== priorityFilter) return false;
      return true;
    });
  }, [overview?.tickets, surfaceFilter, priorityFilter]);

  const filteredCalls = useMemo(() => {
    const rows = Array.isArray(overview?.calls) ? overview.calls : [];
    if (surfaceFilter === "ALL") return rows;
    return rows.filter((call) => String(call.status || "") === surfaceFilter);
  }, [overview?.calls, surfaceFilter]);

  const filteredAlerts = useMemo(() => {
    const rows = Array.isArray(overview?.alerts) ? overview.alerts : [];
    if (priorityFilter === "ALL") return rows;
    return rows.filter((alert) => String(alert.severity || "") === priorityFilter);
  }, [overview?.alerts, priorityFilter]);

  const entityContext = currentEntityContext(selection, recordData);
  const selectedRecord = buildSelectionRecord(selection, recordData);
  const selectedCall = selection?.type === "call" ? (recordData?.record || selection.item) : null;

  const sendMessage = async () => {
    const body = draft.trim();
    if (!body || !activeChannelId) return;
    try {
      await sendAssistantMessage({ channelId: activeChannelId, body });
      setDraft("");
      await loadMessages(activeChannelId);
    } catch (err) {
      setMessage(err?.message || "Failed to send message.");
    }
  };

  const askAi = async () => {
    if (!selection) return;
    setAiLoading(true);
    setAiDraft("");
    try {
      const prompt = buildAiPrompt(selection, recordData, workspaceSettings);
      const routeContext = "unified-assistant";
      const data = await chatAssistant({
        request: {
          message: prompt,
          userMessage: prompt,
          pageContext: routeContext,
          channel: "web",
          client: "browser",
        },
        aiContext: {
          pageContext: routeContext,
        },
      });
      setAiDraft(data?.answer || data?.text || "No AI suggestion returned.");
    } catch (err) {
      setAiDraft(err?.message || "AI suggestion is unavailable right now.");
    } finally {
      setAiLoading(false);
    }
  };

  const updateTicket = async (status) => {
    const ticketId = recordData?.record?._id || selection?.item?._id;
    if (!ticketId) return;
    setTicketSaving(true);
    try {
      await updateSupportTicket(ticketId, { status, note: ticketNote });
      setTicketNote("");
      setMessage(`Ticket updated to ${status}.`);
      setRefreshTick((value) => value + 1);
      const fresh = await getUnifiedAssistantRecord({ kind: "ticket", id: ticketId, hospitalId: hospitalScope || undefined });
      setRecordData(fresh);
    } catch (err) {
      setMessage(err?.message || "Failed to update support ticket.");
    } finally {
      setTicketSaving(false);
    }
  };

  const blockCall = async () => {
    const callId = recordData?.record?._id || selection?.item?._id;
    if (!callId || !canBlockCalls) return;
    setCallActionLoading(`block-${callId}`);
    try {
      await apiFetch(`/api/appointments/calls/${callId}/block`, {
        method: "PATCH",
        body: { reason: "Blocked from Unified Assistant Dashboard" },
      });
      setMessage("Call blocked.");
      setActiveConsultationCall(null);
      setRefreshTick((value) => value + 1);
      const fresh = await getUnifiedAssistantRecord({ kind: "call", id: callId, hospitalId: hospitalScope || undefined });
      setRecordData(fresh);
    } catch (err) {
      setMessage(err?.message || "Failed to block call.");
    } finally {
      setCallActionLoading("");
    }
  };

  const openEmbeddedConsultation = async () => {
    const callId = selectedCall?._id;
    if (!callId || !canOperateCalls) return;
    setCallActionLoading(`open-${callId}`);
    try {
      if (String(selectedCall?.status || "") !== "ACTIVE") {
        await apiFetch(`/api/appointments/calls/${callId}/activate`, {
          method: "PATCH",
        });
      }
      const fresh = await getUnifiedAssistantRecord({ kind: "call", id: callId, hospitalId: hospitalScope || undefined });
      setRecordData(fresh);
      setActiveConsultationCall(fresh?.record || selectedCall);
      setMessage("Consultation room opened inside the assistant workspace.");
      setRefreshTick((value) => value + 1);
    } catch (err) {
      setMessage(err?.message || "Could not open consultation room.");
    } finally {
      setCallActionLoading("");
    }
  };

  const endEmbeddedConsultation = async (call = activeConsultationCall || selectedCall) => {
    const callId = call?._id;
    if (!callId) return;
    setCallActionLoading(`end-${callId}`);
    try {
      await apiFetch(`/api/appointments/calls/${callId}/end`, {
        method: "PATCH",
      });
      setActiveConsultationCall(null);
      setMessage("Consultation ended.");
      setRefreshTick((value) => value + 1);
      const fresh = await getUnifiedAssistantRecord({ kind: "call", id: callId, hospitalId: hospitalScope || undefined });
      setRecordData(fresh);
    } catch (err) {
      setMessage(err?.message || "Failed to end consultation.");
    } finally {
      setCallActionLoading("");
    }
  };

  const openRelatedRecord = () => {
    if (!selection) return;
    if (selection.type === "alert" && selection.item?.entityKind && selection.item?.entityId) {
      setSelection({
        type: "record",
        item: {
          kind: selection.item.entityKind,
          id: selection.item.entityId,
        },
      });
      return;
    }
    if (selection.type === "call" && recordData?.record?.patient?._id) {
      setSelection({ type: "record", item: { kind: "patient", id: recordData.record.patient._id } });
    }
  };

  const openSpecificRecord = (kind, id) => {
    if (!kind || !id) return;
    setSelection({ type: "record", item: { kind, id } });
  };

  const openDirectPath = (path) => {
    if (!path) return;
    navigate(path);
  };

  const openRecordDestination = (kind, record) => {
    if (!kind || !record) return;
    const path = canRouteOutsideWorkspace ? resolveUnifiedRecordPath(kind, record) : "";
    if (path) {
      navigate(path);
      return;
    }
    if (record?._id) {
      openSpecificRecord(kind, record._id);
    }
  };

  const openMainAction = (target) => {
    if (target === "search") {
      searchInputRef.current?.focus();
      return;
    }
    if (target === "financials") {
      if (!canOpenFinancials) {
        setMessage("Financial controls for this role are already surfaced inside the workspace.");
        return;
      }
      navigate("/app/revenue/financials/index");
      return;
    }
    if (target === "fraud") {
      if (!canOpenFraudGuard) {
        setMessage("Fraud actions for this role stay inside the unified workspace.");
        return;
      }
      navigate("/app/governance/fraud/index");
      return;
    }
    if (target === "developer") {
      navigate("/app/platform/dev/home");
      return;
    }
    if (target === "records") {
      openRelatedRecord();
      return;
    }
    if (target === "ai") {
      void askAi();
    }
  };

  const saveWorkspaceMode = async () => {
    setSettingsSaving(true);
    setMessage("");
    try {
      const data = await updateUnifiedAssistantSettings({
        hospitalId: hospitalScope || undefined,
        operatingMode: modeDraft,
        humanAvailability: {
          status: availabilityDraft,
          note: handoffNote,
        },
        handoffPolicy: workspaceSettings?.handoffPolicy || undefined,
        entityKind: entityContext.kind,
        entityId: entityContext.id,
      });
      syncWorkspaceState(data?.settings, data?.handoffLogs);
      setMessage(`Assistant mode saved as ${formatModeLabel(data?.settings?.operatingMode || modeDraft)}.`);
    } catch (err) {
      setMessage(err?.message || "Failed to save assistant operating mode.");
      try {
        const data = await getUnifiedAssistantSettings({ hospitalId: hospitalScope || undefined });
        syncWorkspaceState(data?.settings, data?.handoffLogs);
      } catch {}
    } finally {
      setSettingsSaving(false);
    }
  };

  const createHandoffEntry = async () => {
    const note = handoffNote.trim();
    if (!note) {
      setMessage("Add a short handoff note before logging the handoff.");
      return;
    }
    setHandoffSaving(true);
    setMessage("");
    try {
      const data = await logUnifiedAssistantHandoff({
        hospitalId: hospitalScope || undefined,
        note,
        fromMode: workspaceSettings?.operatingMode || modeDraft,
        toMode: modeDraft,
        fromAvailability: workspaceSettings?.humanAvailability?.status || availabilityDraft,
        toAvailability: availabilityDraft,
        entityKind: entityContext.kind,
        entityId: entityContext.id,
      });
      setHandoffLogs(safeArray(data?.handoffLogs));
      setMessage("Handoff log recorded.");
      setHandoffNote("");
    } catch (err) {
      setMessage(err?.message || "Failed to log handoff.");
    } finally {
      setHandoffSaving(false);
    }
  };

  const currentMode = workspaceSettings?.operatingMode || modeDraft;
  const currentAvailability = workspaceSettings?.humanAvailability?.status || availabilityDraft;
  const takeoverActive = Boolean(workspaceSettings?.takeover?.active || currentMode === "TAKEOVER");

  return {
    navigate,
    searchInputRef,
    messageScrollerRef,
    hospitalScope,
    setHospitalScope,
    overview,
    loading,
    message,
    setMessage,
    selection,
    setSelection,
    recordData,
    recordLoading,
    searchQuery,
    setSearchQuery,
    searching,
    searchResults,
    searchMsg,
    channelMessages,
    messagesLoading,
    nextCursor,
    draft,
    setDraft,
    ticketNote,
    setTicketNote,
    ticketSaving,
    aiDraft,
    aiLoading,
    surfaceFilter,
    setSurfaceFilter,
    priorityFilter,
    setPriorityFilter,
    refreshTick,
    setRefreshTick,
    workspaceSettings,
    handoffLogs,
    modeDraft,
    setModeDraft,
    availabilityDraft,
    setAvailabilityDraft,
    handoffNote,
    setHandoffNote,
    settingsSaving,
    handoffSaving,
    activeConsultationCall,
    setActiveConsultationCall,
    callActionLoading,
    role,
    canOpenConsultationMonitor,
    canOpenFinancials,
    canOpenFraudGuard,
    canOpenDeveloper,
    canRouteOutsideWorkspace,
    canBlockCalls,
    canOperateCalls,
    consultationRoomRole,
    isGlobal,
    filteredTickets,
    filteredCalls,
    filteredAlerts,
    entityContext,
    selectedRecord,
    selectedCall,
    sendMessage,
    askAi,
    updateTicket,
    blockCall,
    openEmbeddedConsultation,
    endEmbeddedConsultation,
    openRelatedRecord,
    openSpecificRecord,
    openDirectPath,
    openRecordDestination,
    openMainAction,
    saveWorkspaceMode,
    createHandoffEntry,
    currentMode,
    currentAvailability,
    takeoverActive,
    MODE_OPTIONS,
    AVAILABILITY_OPTIONS,
    formatDate,
    formatMoney,
    patientName,
    userName,
    badgeClass,
    formatModeLabel,
    formatAvailabilityLabel,
    scalarText,
    safeArray,
  };
}

export default useUnifiedAssistantDashboard;
