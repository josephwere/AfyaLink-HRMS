import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppIcon from "./AppIcon";
import { useSocket } from "../utils/socket.jsx";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/notificationsApi";

const MAX_ITEMS = 40;

function normalizeCategory(value, title = "") {
  const raw = String(value || title || "SYSTEM").toUpperCase();
  if (raw.includes("PRESCRIPTION") || raw.includes("PHARMACY")) return "PRESCRIPTIONS";
  if (raw.includes("CONSULT")) return "CONSULTATION";
  if (raw.includes("APPOINT")) return "CLINICAL";
  if (raw.includes("AI")) return "AI";
  if (raw.includes("ACCOUNT") || raw.includes("PROFILE") || raw.includes("PASSWORD") || raw.includes("2FA")) return "ACCOUNT";
  if (raw.includes("LAB")) return "CLINICAL";
  if (raw.includes("BILLING") || raw.includes("PAYMENT")) return "BILLING";
  return raw || "SYSTEM";
}

function categoryIcon(category) {
  const normalized = normalizeCategory(category);
  if (normalized === "PRESCRIPTIONS") return "Rx";
  if (normalized === "CONSULTATION") return "Dr";
  if (normalized === "AI") return "AI";
  if (normalized === "ACCOUNT") return "ID";
  if (normalized === "BILLING") return "KES";
  return "Med";
}

function groupLabel(createdAt) {
  const date = new Date(createdAt || Date.now());
  if (Number.isNaN(date.getTime())) return "Earlier";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const weekAgo = new Date();
  weekAgo.setDate(today.getDate() - 7);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  if (date >= weekAgo) return "This Week";
  return "Earlier";
}

function inferPrimaryPath(item) {
  const metaPath = item?.meta?.path;
  if (metaPath) return metaPath;
  const category = normalizeCategory(item?.category, item?.title);
  const title = String(item?.title || "").toLowerCase();
  if (category === "PRESCRIPTIONS") return "/patient/prescriptions";
  if (category === "CONSULTATION") return "/patient/appointments";
  if (title.includes("lab")) return "/patient/lab-results";
  if (title.includes("profile") || category === "ACCOUNT") return "/app/platform/account/profile";
  if (category === "BILLING") return "/patient/billing";
  if (category === "CLINICAL") return "/patient/appointments";
  return "/app/platform/inbox/notifications";
}

function buildAiPrompt(item) {
  const title = String(item?.title || "this update").trim();
  const body = String(item?.body || "").trim();
  const category = normalizeCategory(item?.category, title);
  if (category === "PRESCRIPTIONS") {
    return `Explain this prescription notification in simple patient-friendly language: ${title}. ${body}`;
  }
  if (category === "CONSULTATION") {
    return `Help me understand and prepare for this consultation update: ${title}. ${body}`;
  }
  if (title.toLowerCase().includes("lab")) {
    return `Explain what this lab result notification may mean and what questions I should ask my clinician: ${title}. ${body}`;
  }
  if (category === "CLINICAL") {
    return `Help me understand this healthcare update and what I should do next: ${title}. ${body}`;
  }
  return `Explain this AfyaLink notification and suggest my next step: ${title}. ${body}`;
}

function localNotificationFromEvent(event) {
  const detail = event?.detail || {};
  return {
    _id: detail.id || `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: detail.title || "Update",
    body: detail.body || detail.message || "",
    category: normalizeCategory(detail.category || detail.title),
    meta: detail.meta || {},
    read: false,
    createdAt: detail.createdAt || new Date().toISOString(),
    localOnly: true,
  };
}

function notificationKey(item) {
  const meta = item?.meta || {};
  const stableId =
    meta.notificationKey ||
    meta.callId ||
    meta.appointmentId ||
    meta.prescriptionId ||
    meta.labResultId ||
    meta.paymentId ||
    meta.encounterId;
  if (stableId) {
    const category = normalizeCategory(item?.category, item?.title);
    const titleKey = category === "CONSULTATION" ? String(item?.title || "").toLowerCase() : "update";
    return `${category}-${titleKey}-${stableId}`;
  }
  return String(item?._id || `${item?.title || "notification"}-${item?.createdAt || ""}`);
}

export default function NotificationCenter() {
  const navigate = useNavigate();
  const socket = useSocket();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const panelRef = useRef(null);

  const unreadCount = useMemo(
    () => items.filter((item) => item.read !== true).length,
    [items]
  );

  const grouped = useMemo(() => {
    const groups = new Map();
    items.slice(0, MAX_ITEMS).forEach((item) => {
      const label = groupLabel(item.createdAt);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(item);
    });
    return ["Today", "Yesterday", "This Week", "Earlier"]
      .map((label) => ({ label, items: groups.get(label) || [] }))
      .filter((group) => group.items.length);
  }, [items]);

  const addLocalNotification = useCallback((item) => {
    setItems((prev) => {
      const next = [item, ...prev].filter(Boolean);
      const seen = new Set();
      return next
        .filter((row) => {
          const key = notificationKey(row);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, MAX_ITEMS);
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const data = await listNotifications({ query: "limit=40" });
      const rows = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      setItems(rows);
    } catch (err) {
      setMessage(err?.message || "Could not load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;
    const handleOutside = (event) => {
      if (panelRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  useEffect(() => {
    const handleLocal = (event) => addLocalNotification(localNotificationFromEvent(event));
    window.addEventListener("afyalink:notification-local", handleLocal);
    return () => window.removeEventListener("afyalink:notification-local", handleLocal);
  }, [addLocalNotification]);

  useEffect(() => {
    if (!socket) return undefined;
    const push = (title, body, category, meta = {}) =>
      addLocalNotification({
        _id: `${category}-${meta.callId || meta.appointmentId || meta.prescriptionId || Date.now()}`,
        title,
        body,
        category,
        meta,
        read: false,
        createdAt: new Date().toISOString(),
      });
    const handlers = {
      appointmentCreated: (data) => push("Appointment confirmed", "Your appointment has been booked.", "CLINICAL", data),
      appointmentUpdated: (data) =>
        push(
          data?.metadata?.followUpRequired ? "Follow-up scheduled" : "Appointment updated",
          data?.metadata?.followUpRequired
            ? "Your doctor recommended a follow-up appointment."
            : "Your appointment details were updated.",
          "CLINICAL",
          data
        ),
      consultation_accepted: (data) => push("Doctor accepted consultation", "Your doctor is ready to join.", "CONSULTATION", data),
      consultation_completed: (data) => push("Consultation completed", "Summary or prescription details will appear when available.", "CONSULTATION", data),
      consultation_declined: (data) => push("Consultation request declined", "The doctor could not join this consultation.", "CONSULTATION", data),
      prescription_issued: (data) => push("New prescription available", "Medication details are ready to review.", "PRESCRIPTIONS", data),
      labResult: (data) => push("Lab results available", "New lab results are ready for review.", "CLINICAL", data),
      paymentRecorded: (data) => push("Payment received", "Your payment was recorded.", "BILLING", data),
    };
    Object.entries(handlers).forEach(([eventName, handler]) => socket.on(eventName, handler));
    return () => {
      Object.entries(handlers).forEach(([eventName, handler]) => socket.off(eventName, handler));
    };
  }, [addLocalNotification, socket]);

  const markRead = async (item) => {
    setItems((prev) => prev.map((row) => (row._id === item._id ? { ...row, read: true } : row)));
    if (item.localOnly || !item._id) return;
    try {
      await markNotificationRead(item._id);
    } catch {
      // Keep optimistic read state; full page refresh can reconcile if needed.
    }
  };

  const markAllRead = async () => {
    setItems((prev) => prev.map((item) => ({ ...item, read: true })));
    try {
      await markAllNotificationsRead();
    } catch {
      // Keep local state responsive.
    }
  };

  const openAi = (item) => {
    setOpen(false);
    window.dispatchEvent(
      new CustomEvent("afyalink:ai-open", {
        detail: {
          prompt: buildAiPrompt(item),
          source: "notification",
        },
      })
    );
  };

  const openItem = async (item) => {
    await markRead(item);
    setOpen(false);
    navigate(inferPrimaryPath(item));
  };

  return (
    <div className="notification-center" ref={panelRef}>
      <button
        type="button"
        className={`notification-center-button${unreadCount ? " has-unread" : ""}`}
        aria-label={`Notifications ${unreadCount}`}
        title="Notifications"
        onClick={() => {
          setOpen((current) => !current);
          if (!open) load();
        }}
      >
        <AppIcon name="notifications" />
        <span className="notification-center-label">Notifications</span>
        {unreadCount ? <strong>{Math.min(unreadCount, 99)}</strong> : null}
      </button>

      {open ? (
        <div className="notification-center-panel" role="dialog" aria-label="Notifications">
          <div className="notification-center-header">
            <div>
              <strong>Notifications</strong>
              <span>{unreadCount ? `${unreadCount} unread` : "All caught up"}</span>
            </div>
            <button type="button" className="action-link" onClick={markAllRead} disabled={!unreadCount}>
              Mark all read
            </button>
          </div>
          {message ? <div className="notification-center-message">{message}</div> : null}
          {loading && !items.length ? <div className="notification-center-message">Loading notifications...</div> : null}
          <div className="notification-center-list">
            {grouped.map((group) => (
              <section key={group.label}>
                <h4>{group.label}</h4>
                {group.items.map((item) => {
                  const category = normalizeCategory(item.category, item.title);
                  return (
                    <article key={notificationKey(item)} className={`notification-center-item${item.read ? "" : " unread"}`}>
                      <div className="notification-center-icon" aria-hidden="true">
                        {categoryIcon(category)}
                      </div>
                      <div className="notification-center-copy">
                        <strong>{item.title || "Notification"}</strong>
                        <p>{item.body || "Open AfyaLink to review this update."}</p>
                        <div className="notification-center-meta">
                          <span>{category}</span>
                          <span>{item.createdAt ? new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Now"}</span>
                        </div>
                        <div className="notification-center-actions">
                          <button type="button" className="btn-secondary" onClick={() => openItem(item)}>
                            View
                          </button>
                          <button type="button" className="btn-secondary" onClick={() => openAi(item)}>
                            Ask AI
                          </button>
                          {!item.read ? (
                            <button type="button" className="btn-secondary" onClick={() => markRead(item)}>
                              Mark read
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </section>
            ))}
            {!grouped.length && !loading ? (
              <div className="notification-center-empty">
                <strong>No notifications yet.</strong>
                <p>Appointment, consultation, prescription, AI, and account updates will appear here.</p>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="notification-center-footer"
            onClick={() => {
              setOpen(false);
              navigate("/app/platform/inbox/notifications");
            }}
          >
            Open full notification center
          </button>
        </div>
      ) : null}
    </div>
  );
}
