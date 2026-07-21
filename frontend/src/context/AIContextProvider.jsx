import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../utils/auth";
import { useSystemSettings } from "../utils/systemSettings.jsx";
import { getAssistantContext } from "../services/assistantApi";
import { publishNeuroEdgeEvent, subscribeToNeuroEdgeEvents, NEUROEDGE_EVENT_TYPES } from "../ai/neuroedgeEventBus";
import { buildContextBridgeState } from "../ai/contextBridge.js";
import { aggregateNeuroEdgeEvent, createInitialNeuroEdgeContextSnapshot } from "../ai/neuroedgeContextAggregator.js";

const AIContextContext = createContext(null);

function normalizePath(pathname = "") {
  return String(pathname || "").trim();
}

function buildWorkspaceContext(pathname = "", user = {}, assistantContext = {}, settings = {}) {
  const path = normalizePath(pathname).toLowerCase();
  const role = String(user?.role || assistantContext?.role || "").toUpperCase();
  const module = path.includes("/billing") || path.includes("/claims") || path.includes("/revenue")
    ? "Billing"
    : path.includes("/appointment") || path.includes("/appointments")
      ? "Scheduling"
      : path.includes("/patient") || path.includes("/care") || path.includes("/opd")
        ? "Clinical"
        : path.includes("/ai")
          ? "AI"
          : "Workspace";

  const workspaceName = path.includes("/pharmacy") ? "Pharmacy"
    : path.includes("/lab") ? "Laboratory"
    : path.includes("/radiology") ? "Radiology"
    : path.includes("/security") ? "Security"
    : path.includes("/super-admin") ? "Administration"
    : path.includes("/hospital-admin") ? "Operations"
    : module;

  return {
    module,
    workspace: workspaceName,
    page: path || "Home",
    route: pathname || "/",
    workflow: path.includes("/appointment") || path.includes("/appointments") ? "Scheduling" : "General assistance",
    organizationId: user?.hospitalId || user?.hospital || assistantContext?.hospitalScope || null,
    hospitalId: user?.hospitalId || user?.hospital || assistantContext?.hospitalScope || null,
    department: assistantContext?.department || user?.department || null,
    patientId: assistantContext?.patientId || null,
    encounterId: assistantContext?.encounterId || null,
    role,
    language: settings?.language || "en",
    theme: settings?.theme || "light",
  };
}

function buildActorContext(user = {}, assistantContext = {}) {
  const role = String(user?.role || assistantContext?.role || "User").toUpperCase();
  return {
    id: user?.id || user?._id || null,
    role,
    permissions: [],
    preferences: {
      memoryEnabled: true,
      defaultResponseStyle: "concise",
    },
  };
}

function buildSubjectContext(pathname = "", assistantContext = {}) {
  const path = normalizePath(pathname);
  return {
    patientId: assistantContext?.patientId || null,
    appointmentId: assistantContext?.nextAppointment?._id || null,
    encounterId: assistantContext?.encounterId || null,
    prescriptionId: assistantContext?.prescriptionId || null,
    labOrderId: assistantContext?.labOrderId || null,
    pageContext: path || null,
  };
}

function buildUiContext() {
  if (typeof document === "undefined") return {};
  const activeElement = document.activeElement;
  const tagName = activeElement?.tagName || "";
  return {
    selectedText: "",
    activeForm: "",
    openDialog: "",
    focusedField: tagName ? `${tagName.toLowerCase()}-input` : "",
  };
}

export function AIContextProvider({ children }) {
  const location = useLocation();
  const { user, loading } = useAuth();
  const { settings } = useSystemSettings();
  const [assistantContext, setAssistantContext] = useState(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [selection, setSelection] = useState("");
  const [currentWorkflow, setCurrentWorkflow] = useState("General assistance");
  const [formContext, setFormContext] = useState({ name: "", focusedField: "", completedFields: 0, remainingFields: 0 });
  const [contextSnapshot, setContextSnapshot] = useState(() => createInitialNeuroEdgeContextSnapshot());
  const [contextEvents, setContextEvents] = useState([]);
  const [contextBridgeState, setContextBridgeState] = useState(() => buildContextBridgeState({}));

  const syncSelection = useCallback(() => {
    if (typeof window === "undefined") return;
    const text = window.getSelection?.()?.toString?.().trim() || "";
    setSelection(text);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleSelectionChange = () => syncSelection();
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, [syncSelection]);

  useEffect(() => {
    const unsubscribe = subscribeToNeuroEdgeEvents((event) => {
      if (!event?.type) return;
      setContextSnapshot((prev) => aggregateNeuroEdgeEvent(prev, event));
      setContextEvents((prev) => [event, ...prev].slice(0, 25));
      publishNeuroEdgeEvent(`${event.type}:received`, { source: event.type, detail: event });
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    publishNeuroEdgeEvent(NEUROEDGE_EVENT_TYPES.PAGE_OPENED, {
      pathname: location.pathname,
      page: location.pathname,
      module: buildWorkspaceContext(location.pathname, user, assistantContext, settings).module,
    });
    return undefined;
  }, [assistantContext, location.pathname, settings, user]);

  useEffect(() => {
    if (user?.role) {
      publishNeuroEdgeEvent(NEUROEDGE_EVENT_TYPES.ROLE_CHANGED, { role: user.role });
    }
  }, [user?.role]);

  const prevUserRef = React.useRef(null);

  useEffect(() => {
    if (loading) return undefined;
    const previousUser = prevUserRef.current;
    if (user && !previousUser) {
      publishNeuroEdgeEvent(NEUROEDGE_EVENT_TYPES.USER_SIGNED_IN, { user });
    }
    if (!user && previousUser) {
      publishNeuroEdgeEvent(NEUROEDGE_EVENT_TYPES.USER_SIGNED_OUT, {});
    }
    prevUserRef.current = user;
    return undefined;
  }, [loading, user]);

  useEffect(() => {
    if (user?.role) {
      publishNeuroEdgeEvent(NEUROEDGE_EVENT_TYPES.ROLE_CHANGED, { role: user.role });
    }
  }, [user?.role]);

  useEffect(() => {
    if (!user || loading) return undefined;
    let alive = true;
    setContextLoading(true);
    getAssistantContext()
      .then((result) => {
        if (!alive) return;
        setAssistantContext(result?.context || null);
      })
      .catch(() => {
        if (!alive) return;
        setAssistantContext(null);
      })
      .finally(() => {
        if (alive) setContextLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [user, loading, location.pathname]);

  const aiContext = useMemo(() => ({
    workspace: {
      ...buildWorkspaceContext(location.pathname, user, assistantContext, settings),
      ...contextSnapshot.currentWorkspace,
    },
    actor: {
      ...buildActorContext(user, assistantContext),
      ...contextSnapshot.actor,
    },
    subject: {
      ...buildSubjectContext(location.pathname, assistantContext),
      patient: contextSnapshot.patient,
      appointment: contextSnapshot.appointment,
    },
    ui: {
      ...buildUiContext(),
      ...contextSnapshot.ui,
    },
    selection,
    workflow: currentWorkflow || contextSnapshot.currentWorkspace.workflow || "General assistance",
    form: {
      ...formContext,
      ...contextSnapshot.form,
    },
    events: contextEvents,
    loading: contextLoading,
    contextSnapshot,
  }), [assistantContext, contextLoading, contextEvents, contextSnapshot, currentWorkflow, formContext, location.pathname, selection, settings, user]);

  useEffect(() => {
    setContextBridgeState(buildContextBridgeState(aiContext));
  }, [aiContext]);

  const setWorkflow = useCallback((workflow) => setCurrentWorkflow(String(workflow || "General assistance").trim() || "General assistance"), []);
  const setFormContextValue = useCallback((next) => setFormContext((prev) => ({ ...prev, ...next })), []);

  const value = useMemo(() => ({
    aiContext,
    contextBridgeState,
    contextSnapshot,
    setWorkflow,
    setFormContext: setFormContextValue,
    refreshContext: () => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("neuroedge:refresh-context"));
      }
    },
  }), [aiContext, contextSnapshot, contextBridgeState, setFormContextValue, setWorkflow]);

  return <AIContextContext.Provider value={value}>{children}</AIContextContext.Provider>;
}

export function useAIContext() {
  const context = useContext(AIContextContext);
  if (!context) {
    throw new Error("useAIContext must be used within an AIContextProvider");
  }
  return context;
}
