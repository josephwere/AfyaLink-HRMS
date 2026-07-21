import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { useSystemSettings } from "../utils/systemSettings.jsx";
import { useAuth } from "../utils/auth";
import { DEFAULT_AI_ICON } from "../constants/aiBranding";
import { getPreferredAssetSource, markAssetBroken } from "../utils/assetFallbacks";
import AIChatWS from "./AIChatWS";
import { useAIContext } from "../context/AIContextProvider";
import { buildContextBridgeState } from "../ai/contextBridge.js";

const OVERLAY_SIZE_KEY = "neuroedgeWorkspaceSize";
const SESSION_STORAGE_KEY = "neuroedgeWorkspaceSession";
const DEFAULT_OVERLAY_SIZE = { width: 980, height: 760 };

function readPersistedWorkspaceSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writePersistedWorkspaceSession(payload) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

function formatAppointment(appointment = {}) {
  try {
    const date = new Date(appointment.scheduledAt || appointment.scheduledAtAt || appointment.date);
    if (Number.isNaN(date.getTime())) return "";
    return `${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })} • ${date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  } catch {
    return "";
  }
}

function getWorkspaceContext(pathname = "", aiContext = {}, contextBridgeState = {}, user) {
  const path = String(pathname || "").toLowerCase();
  const patient = aiContext.subject?.patient || {};
  const appointment = aiContext.subject?.appointment || {};
  const workspace = aiContext.workspace || {};
  const module = workspace.module || "Workspace";
  const currentTask = workspace.currentTask || aiContext.workflow || "General assistance";
  const details = [];
  const suggestions = [];
  let title = "NeuroEdge Workspace";
  let subtitle = "Ask NeuroEdge for help with the current workflow.";

  if (module === "Billing") {
    title = "Billing workspace";
    subtitle = "Explain invoices, check coverage, and draft appeals.";
  } else if (module === "Scheduling") {
    title = "Appointment workspace";
    subtitle = "Book follow-ups and verify schedule details.";
  } else if (module === "Clinical") {
    title = "Clinical workspace";
    subtitle = "Use patient context for notes, diagnosis, and plans.";
  } else if (path.includes("/app/platform/ai") || path.includes("/ai/")) {
    title = "NeuroEdge workspace";
    subtitle = "Advanced AI tools and conversation history.";
  }

  if (user?.role) {
    details.push({ label: "Role", value: String(user.role).replace(/_/g, " ").toUpperCase() });
  }

  if (patient?.firstName || patient?.lastName) {
    details.push({ label: "Patient", value: `${patient.firstName || ""} ${patient.lastName || ""}`.trim() });
  }

  if (appointment?.scheduledAt) {
    details.push({ label: "Appointment", value: formatAppointment(appointment) || "Scheduled soon" });
  }

  if (workspace.department) {
    details.push({ label: "Department", value: workspace.department });
  }

  if (workspace.hospitalId) {
    details.push({ label: "Hospital", value: workspace.hospitalId });
  }

  if (currentTask) {
    details.push({ label: "Current task", value: currentTask });
  }

  if (!suggestions.length) {
    suggestions.push("Summarize the current page", "Explain the current record", "Draft a short note");
  }

  const pageContext = [
    `Workspace: ${title}`,
    `Role: ${user?.role || "Guest"}`,
    patient?.firstName || appointment?.scheduledAt ? `Context: ${patient?.firstName || "No patient"}` : "",
    currentTask ? `Task: ${currentTask}` : "",
  ]
    .filter(Boolean)
    .join(" \u2022 ");

  return { title, subtitle, details, suggestions, pageContext };
}

export default function FloatingAI() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useAuth();
  const { settings } = useSystemSettings();
  const { aiContext } = useAIContext();
  const ai = settings?.ai;

  const [launcherIconSrc, setLauncherIconSrc] = useState(() =>
    getPreferredAssetSource(ai?.icon, DEFAULT_AI_ICON)
  );
  const [launcherIconBroken, setLauncherIconBroken] = useState(false);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [assistantContext, setAssistantContext] = useState(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState(() => {
    const persisted = readPersistedWorkspaceSession();
    return Array.isArray(persisted?.messages) ? persisted.messages : [];
  });
  const [chatInput, setChatInput] = useState(() => {
    const persisted = readPersistedWorkspaceSession();
    return typeof persisted?.input === "string" ? persisted.input : "";
  });
  const [overlaySize, setOverlaySize] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_OVERLAY_SIZE;
    try {
      const saved = JSON.parse(window.localStorage.getItem(OVERLAY_SIZE_KEY));
      if (saved?.width && saved?.height) return saved;
    } catch {
      // ignore malformed saved state
    }
    return DEFAULT_OVERLAY_SIZE;
  });
  const [isResizing, setIsResizing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [presetPrompt, setPresetPrompt] = useState("");

  const floatButtonRef = useRef(null);
  const previousActiveElementRef = useRef(null);
  const resizeStateRef = useRef(null);

  const aiName = ai?.name || "NeuroEdge";
  const preferredLauncherIcon = getPreferredAssetSource(ai?.icon, DEFAULT_AI_ICON);
  const greeting = ai?.greeting || "Assistant";
  const isAuthenticated = Boolean(user);
  const role = String(user?.role || "GUEST").toUpperCase();
  const isPatient = role === "PATIENT";
  const isGuest = role === "GUEST";
  const aiAccess = settings?.monetization?.featureAccess?.ai || "FREE";
  const aiEnabled = ai?.enabled !== false;
  const adminRoles = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"];
  const canUseAI = aiEnabled && (aiAccess !== "PREMIUM" || isPatient || isGuest || adminRoles.includes(role));
  const aiLocked = !canUseAI || !isAuthenticated;
  const hasIcon = Boolean(launcherIconSrc) && !launcherIconBroken;
  const launcherLabel = `${aiName} ${greeting}`;
  const launcherInitials = String(aiName || "AI")
    .split(/\s+/)
    .map((part) => part?.[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase() || "AI";

  const hideFloatingLauncher = useMemo(() => {
    const pathname = String(location.pathname || "").toLowerCase();
    return (
      pathname.startsWith("/app/innovation/ai/chatbot") ||
      pathname.startsWith("/app/innovation/ai/medical-assistant") ||
      pathname.startsWith("/ai/chatbot") ||
      pathname.startsWith("/ai/medical-assistant")
    );
  }, [location.pathname]);

  const workspaceContext = useMemo(() => {
    const providerContext = aiContext || {};
    const contextBridgeState = buildContextBridgeState(providerContext);
    const baseContext = getWorkspaceContext(location.pathname, providerContext, contextBridgeState, user);
    return {
      ...baseContext,
      pageContext: baseContext.pageContext || `${contextBridgeState.contextSummary.workspace} • ${contextBridgeState.contextSummary.role}`,
      contextBridgeState,
      suggestions: [],
    };
  }, [aiContext, location.pathname, user]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    writePersistedWorkspaceSession({
      messages: chatMessages,
      input: chatInput,
      pageContext: workspaceContext.pageContext,
      updatedAt: Date.now(),
    });
    return undefined;
  }, [chatMessages, chatInput, workspaceContext.pageContext]);

  useEffect(() => {
    setLauncherIconSrc(preferredLauncherIcon);
    setLauncherIconBroken(false);
  }, [preferredLauncherIcon]);

  useEffect(() => {
    if (!isOverlayOpen) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOverlayOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOverlayOpen]);

  useEffect(() => {
    if (isOverlayOpen && hideFloatingLauncher) {
      setIsOverlayOpen(false);
    }
  }, [hideFloatingLauncher, isOverlayOpen]);

  useEffect(() => {
    if (isOverlayOpen) {
      previousActiveElementRef.current = document.activeElement;
    } else if (previousActiveElementRef.current?.focus) {
      previousActiveElementRef.current.focus();
      previousActiveElementRef.current = null;
    }
  }, [isOverlayOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleAiOpen = (event) => {
      const detail = event?.detail || {};
      if (!detail?.prompt && detail?.action !== "ai") return;
      setPresetPrompt(detail.prompt || "");
      setIsOverlayOpen(true);
    };

    window.addEventListener("afyalink:ai-open", handleAiOpen);
    return () => window.removeEventListener("afyalink:ai-open", handleAiOpen);
  }, []);

  const loadAssistantContext = async () => {
    setContextLoading(true);
    try {
      const result = await getAssistantContext();
      const context = result?.context || null;
      setAssistantContext(context);
      const history = Array.isArray(context?.chatHistory) ? context.chatHistory : [];
      if (history.length && !chatMessages.length) {
        setChatMessages(
          history.map((entry, index) => ({
            id: entry.id || `${entry.role || "assistant"}-${entry.createdAt || Date.now()}-${index}`,
            from: entry.role === "user" ? "user" : "ai",
            text: entry.text || "",
            streaming: false,
            sourcePrompt: entry.role === "user" ? entry.text || "" : undefined,
            provider: entry.role === "assistant" ? entry.provider || "" : undefined,
          }))
        );
      }
    } catch {
      setAssistantContext(null);
    } finally {
      setContextLoading(false);
    }
  };

  useEffect(() => {
    if (!isOverlayOpen) return undefined;
    loadAssistantContext();
    return undefined;
  }, [isOverlayOpen, location.pathname]);

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const saveOverlaySize = (nextSize) => {
    setOverlaySize(nextSize);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(OVERLAY_SIZE_KEY, JSON.stringify(nextSize));
      } catch {
        // ignore write failures
      }
    }
  };

  const handleResizeStart = (event) => {
    event.preventDefault();
    resizeStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startWidth: overlaySize.width,
      startHeight: overlaySize.height,
    };
    setIsResizing(true);
  };

  const handleResizeMove = (event) => {
    if (!resizeStateRef.current) return;
    const deltaX = event.clientX - resizeStateRef.current.startX;
    const deltaY = event.clientY - resizeStateRef.current.startY;
    saveOverlaySize({
      width: clamp(resizeStateRef.current.startWidth + deltaX, 640, window.innerWidth - 64),
      height: clamp(resizeStateRef.current.startHeight + deltaY, 520, window.innerHeight - 80),
    });
  };

  const handleResizeEnd = () => {
    if (!isResizing) return;
    resizeStateRef.current = null;
    setIsResizing(false);
  };

  useEffect(() => {
    if (!isResizing) return undefined;
    window.addEventListener("mousemove", handleResizeMove);
    window.addEventListener("mouseup", handleResizeEnd);
    return () => {
      window.removeEventListener("mousemove", handleResizeMove);
      window.removeEventListener("mouseup", handleResizeEnd);
    };
  }, [isResizing, handleResizeMove]);

  const handleLauncherIconError = () => {
    markAssetBroken(launcherIconSrc);
    if (launcherIconSrc && launcherIconSrc !== DEFAULT_AI_ICON) {
      setLauncherIconSrc(DEFAULT_AI_ICON);
      setLauncherIconBroken(false);
      return;
    }
    setLauncherIconBroken(true);
  };

  const handleToggleOverlay = () => {
    if (!aiLocked) {
      setIsOverlayOpen((current) => !current);
    }
  };

  const navigateToChatPage = () => {
    setIsOverlayOpen(false);
    navigate("/app/innovation/ai/chatbot");
  };

  if (loading || typeof document === "undefined" || hideFloatingLauncher) return null;

  return createPortal(
    <>
      <button
        type="button"
        className={`ai-float ai-float-icon-only${hasIcon ? "" : " ai-float-fallback-only"}`}
        onClick={handleToggleOverlay}
        title={launcherLabel}
        aria-label={launcherLabel}
        aria-expanded={isOverlayOpen}
        data-label={launcherLabel}
        style={{ position: "fixed", right: 20, bottom: 20, zIndex: 2147483647 }}
        ref={floatButtonRef}
        disabled={aiLocked}
      >
        <span className={`ai-float-icon${hasIcon ? "" : " ai-float-icon-fallback"}`} aria-hidden="true">
          {hasIcon ? (
            <img src={launcherIconSrc} alt="" onError={handleLauncherIconError} decoding="async" loading="lazy" />
          ) : (
            <span className="ai-float-monogram">{launcherInitials}</span>
          )}
        </span>
        <span className="ai-float-presence" aria-hidden="true" />
        <span className="sr-only">{launcherLabel}</span>
      </button>

      {isOverlayOpen ? (
        <div className="ai-overlay-backdrop ai-overlay-open" role="dialog" aria-modal="true" onClick={() => setIsOverlayOpen(false)}>
          <div
            className={`ai-overlay-panel${isFullscreen ? " is-fullscreen" : ""}`}
            onClick={(event) => event.stopPropagation()}
            style={{
              width: isFullscreen ? "calc(100vw - 48px)" : overlaySize.width,
              height: isFullscreen ? "calc(100vh - 48px)" : overlaySize.height,
            }}
          >
          <div className="ai-overlay-header">
            <div className="ai-overlay-title">
              <span className={`ai-float-icon${hasIcon ? "" : " ai-float-icon-fallback"}`} aria-hidden="true">
                {hasIcon ? (
                  <img src={launcherIconSrc} alt="" onError={handleLauncherIconError} decoding="async" loading="lazy" />
                ) : (
                  <span className="ai-float-monogram">{launcherInitials}</span>
                )}
              </span>
              <div>
                <h2>{workspaceContext.title}</h2>
                <p className="muted">{workspaceContext.subtitle}</p>
              </div>
            </div>
            <div className="ai-overlay-actions">
              <button type="button" className="btn-secondary" onClick={navigateToChatPage}>
                Open full page
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setIsFullscreen((current) => !current)}
              >
                {isFullscreen ? "Restore" : "Full screen"}
              </button>
              <button type="button" className="btn-icon" onClick={() => setIsOverlayOpen(false)} aria-label="Close AI overlay">
                ×
              </button>
            </div>
          </div>
          <div className="ai-overlay-context">
            {contextLoading ? (
              <div className="ai-context-loading">Loading workspace context…</div>
            ) : (
              <>
                <div className="ai-overlay-context-summary">
                  <div className="ai-overlay-context-heading">
                    <span className="context-chip">Current context</span>
                    <div>
                      <h3>{workspaceContext.title}</h3>
                      <p className="muted">{workspaceContext.subtitle}</p>
                    </div>
                  </div>
                  <div className="context-detail-grid">
                    {workspaceContext.details.map((detail) => (
                      <div key={detail.label} className="context-detail-item">
                        <strong>{detail.label}</strong>
                        <span>{detail.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="ai-overlay-suggestions">
                  <strong>Suggested actions</strong>
                  <div className="suggestion-pill-grid">
                    {workspaceContext.suggestions.slice(0, 4).map((suggestion) => (
                      <button
                        type="button"
                        key={suggestion}
                        className="suggestion-pill"
                        onClick={() => setPresetPrompt(suggestion)}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="ai-overlay-body">
            <AIChatWS
              messages={chatMessages}
              setMessages={setChatMessages}
              input={chatInput}
              setInput={setChatInput}
              presetPrompt={presetPrompt}
              pageContext={workspaceContext.pageContext}
            />
          </div>
          <div className="ai-overlay-footer">
            <span>Tip: this workspace keeps the conversation alive when you minimize the AI overlay.</span>
            <button type="button" className="btn-link" onClick={navigateToChatPage}>
              Open dedicated AI page
            </button>
          </div>
          <button
            type="button"
            className="ai-overlay-resizer"
            aria-label="Resize AI workspace"
            onMouseDown={handleResizeStart}
          />
        </div>
      </div>
      ) : null}
    </>,
    document.body
  );
}
