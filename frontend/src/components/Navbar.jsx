import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../utils/auth";
import { redirectByRole } from "../utils/redirectByRole";
import { getSearchCatalog } from "../config/searchCatalog";
import { useTheme } from "../utils/theme.jsx";
import { triggerAction } from "../services/actionApi";
import { useSystemSettings } from "../utils/systemSettings.jsx";
import { globalSearch } from "../services/searchApi";
import {
  getDeveloperOverview,
  runWorkflowSlaScan,
} from "../services/developerApi";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
} from "../services/notificationsApi";

function Icon({ name }) {
  const icons = {
    menu: "☰",
    home: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M4 11.5 12 5l8 6.5v7a1 1 0 0 1-1 1h-5v-5H10v5H5a1 1 0 0 1-1-1z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    ),
    bell: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M18 16H6l1.5-2V10a4.5 4.5 0 0 1 9 0v4z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M10 18a2 2 0 0 0 4 0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
    chat: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M6 6h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-4 3v-3H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    ),
    help: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M9 9a3 3 0 1 1 3 3v2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <circle cx="12" cy="17" r="1" fill="currentColor" />
        <circle
          cx="12"
          cy="12"
          r="9"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />
      </svg>
    ),
    settings: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.5-2.4.8a7.4 7.4 0 0 0-2-1.2l-.4-2.5H10l-.4 2.5a7.4 7.4 0 0 0-2 1.2l-2.4-.8-2 3.5 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.5 2.4-.8a7.4 7.4 0 0 0 2 1.2l.4 2.5h4l.4-2.5a7.4 7.4 0 0 0 2-1.2l2.4.8 2-3.5-2-1.5c.1-.4.1-.8.1-1.2z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
      </svg>
    ),
    sun: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    ),
    calendar: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="5" width="16" height="15" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 3v4M16 3v4M4 9h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
    emergency: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4 3 20h18L12 4z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M12 10v4M12 17h.01" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  };

  return <span className="icon">{icons[name] || null}</span>;
}

export default function Navbar({ onToggleSidebar }) {
  const { user, logout, roleOverride, strictImpersonation } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, cycleTheme } = useTheme();
  const { settings } = useSystemSettings();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifItems, setNotifItems] = useState([]);
  const [machineAlertCount, setMachineAlertCount] = useState(0);
  const [trainingAlertCount, setTrainingAlertCount] = useState(0);
  const [notifCategory, setNotifCategory] = useState("ALL");
  const [notifRead, setNotifRead] = useState("ALL");
  const [search, setSearch] = useState("");
  const [remoteResults, setRemoteResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [slaStatus, setSlaStatus] = useState(() => {
    try {
      const raw = localStorage.getItem("workflow_sla_last_scan");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [runningSla, setRunningSla] = useState(false);
  const refreshIntervalMs = 15000;
  const logo = settings?.branding?.logo;
  const profileRef = useRef(null);

  const isGuest = user?.role === "GUEST";
  const isDoctorRole = user?.role === "DOCTOR";
  const currentRole = String(user?.role || "").toUpperCase();
  const canMachineOps = ["HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"].includes(
    currentRole
  );
  const canTrainingOps = [
    "SUPER_ADMIN",
    "SYSTEM_ADMIN",
    "DEVELOPER",
    "HOSPITAL_ADMIN",
    "HR_MANAGER",
  ].includes(currentRole);
  const canApprovalsOps = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "HR_MANAGER"].includes(
    currentRole
  );
  const homePath = user ? redirectByRole(user) : "/";

  const catalog = useMemo(() => getSearchCatalog(user), [user]);
  const localResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return catalog
      .filter((item) => item.label.toLowerCase().includes(q))
      .slice(0, 8);
  }, [search, catalog]);

  useEffect(() => {
    const query = search.trim();
    if (!user || query.length < 2) {
      setRemoteResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const role = String(user?.role || "").toUpperCase();
    const canViewHospitals = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role);
    const canViewWorkers = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN"].includes(role);
    const id = setTimeout(() => {
      globalSearch({ q: query, limit: 6 })
        .then((data) => {
          const hospitals = (data?.hospitals || []).map((h) => ({
            label: `Hospital: ${h.name}${h.code ? ` (${h.code})` : ""}`,
            path: canViewHospitals
              ? `/super-admin/hospitals?q=${encodeURIComponent(h.name || h.code || "")}`
              : homePath,
            source: "remote-hospital",
          }));
          const workers = (data?.workers || []).map((w) => ({
            label: `${w.name} • ${w.role}`,
            path: canViewWorkers
              ? `/hospital-admin/staff?q=${encodeURIComponent(w.name || w.email || "")}`
              : "/profile",
            source: "remote-worker",
          }));
          setRemoteResults([...hospitals, ...workers]);
        })
        .catch(() => setRemoteResults([]))
        .finally(() => setSearching(false));
    }, 250);

    return () => clearTimeout(id);
  }, [search, user, homePath]);

  const results = useMemo(() => {
    const seen = new Set();
    const merged = [...remoteResults, ...localResults];
    return merged.filter((item) => {
      const key = `${item.path}|${item.label}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 12);
  }, [localResults, remoteResults]);

  const unreadCount = useMemo(
    () => notifItems.filter((n) => !n.read).length,
    [notifItems]
  );
  const machineUnreadFromCurrent = useMemo(
    () =>
      notifItems.filter((n) => {
        if (n.read) return false;
        const title = String(n?.title || "").toLowerCase();
        const body = String(n?.body || "").toLowerCase();
        const reason = String(n?.meta?.reason || "").toLowerCase();
        const action = String(n?.meta?.action || "").toLowerCase();
        return (
          title.includes("machine") ||
          body.includes("machine") ||
          reason.includes("heartbeat_timeout") ||
          action.startsWith("machine.")
        );
      }).length,
    [notifItems]
  );
  const trainingUnreadFromCurrent = useMemo(
    () =>
      notifItems.filter((n) => {
        if (n.read) return false;
        if (String(n?.category || "").toUpperCase() === "TRAINING") return true;
        const title = String(n?.title || "").toLowerCase();
        return title.includes("training");
      }).length,
    [notifItems]
  );
  const isRoleOverrideActive =
    Boolean(roleOverride) &&
    Boolean(user?.actualRole) &&
    user.actualRole !== user.role;
  const canSlaOps = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(
    user?.role
  );

  const canOpenNotificationPath = useCallback(
    (path) => {
      const p = String(path || "").trim();
      if (!p) return false;

      if (p.startsWith("/admin/training-tracker")) return canTrainingOps;
      if (p.startsWith("/hospital-admin/machine-alerts")) return canMachineOps;
      if (p.startsWith("/hospital-admin/machine-connectivity")) return canMachineOps;
      if (p.startsWith("/hospital-admin/approvals")) return canApprovalsOps;

      if (p.startsWith("/super-admin/hospitals")) {
        return ["SUPER_ADMIN", "SYSTEM_ADMIN"].includes(currentRole);
      }
      if (p.startsWith("/super-admin/settings")) {
        return ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(currentRole);
      }
      if (p === "/super-admin" || p.startsWith("/super-admin/")) {
        return currentRole === "SUPER_ADMIN";
      }

      if (p.startsWith("/system-admin/")) {
        return ["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"].includes(currentRole);
      }

      if (p.startsWith("/developer/") || p === "/developer") {
        return ["DEVELOPER", "SUPER_ADMIN", "SYSTEM_ADMIN"].includes(currentRole);
      }

      if (p.startsWith("/hospital-admin/")) {
        return ["HOSPITAL_ADMIN", "HR_MANAGER", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(
          currentRole
        );
      }

      if (p.startsWith("/admin/")) {
        return ["SUPER_ADMIN", "SYSTEM_ADMIN", "HOSPITAL_ADMIN", "DEVELOPER"].includes(currentRole);
      }

      return true;
    },
    [canApprovalsOps, canMachineOps, canTrainingOps, currentRole]
  );

  const loadSlaStatus = useCallback(async () => {
    if (!canSlaOps) return;
    try {
      const overview = await getDeveloperOverview();
      const next = {
        pending: overview?.queues?.workforce?.totalPending ?? 0,
        breached: overview?.queues?.workforce?.breached ?? 0,
        updatedAt: new Date().toISOString(),
        lastScanAt: slaStatus?.lastScanAt || null,
        escalationsL1: slaStatus?.escalationsL1 || 0,
        escalationsL2: slaStatus?.escalationsL2 || 0,
      };
      setSlaStatus(next);
      localStorage.setItem("workflow_sla_last_scan", JSON.stringify(next));
    } catch {
      // ignore status refresh errors in navbar
    }
  }, [canSlaOps, slaStatus?.escalationsL1, slaStatus?.escalationsL2, slaStatus?.lastScanAt]);

  const fetchNotifications = useCallback(() => {
    const params = new URLSearchParams();
    if (notifCategory !== "ALL") params.set("category", notifCategory);
    if (notifRead === "READ") params.set("read", "true");
    if (notifRead === "UNREAD") params.set("read", "false");
    const query = params.toString();
    listNotifications({ query })
      .then((data) => {
        if (Array.isArray(data)) setNotifItems(data);
        else if (Array.isArray(data?.items)) setNotifItems(data.items);
        else setNotifItems([]);
      })
      .catch(() => setNotifItems([]));
  }, [notifCategory, notifRead]);

  const fetchMachineAlerts = useCallback(() => {
    listNotifications({ query: "category=INTEGRATION&read=false&limit=120" })
      .then((data) => {
        const rows = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
        const count = rows.filter((n) => {
          const title = String(n?.title || "").toLowerCase();
          const body = String(n?.body || "").toLowerCase();
          const reason = String(n?.meta?.reason || "").toLowerCase();
          const action = String(n?.meta?.action || "").toLowerCase();
          return (
            title.includes("machine") ||
            body.includes("machine") ||
            reason.includes("heartbeat_timeout") ||
            action.startsWith("machine.")
          );
        }).length;
        setMachineAlertCount(count);
      })
      .catch(() => setMachineAlertCount(0));
  }, []);

  const fetchTrainingAlerts = useCallback(() => {
    listNotifications({ query: "category=TRAINING&read=false&limit=120" })
      .then((data) => {
        const rows = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
        setTrainingAlertCount(rows.length);
      })
      .catch(() => setTrainingAlertCount(0));
  }, []);

  const safeTrigger = useCallback(async (action) => {
    try {
      await triggerAction(action);
    } catch {
      // Ignore telemetry/action hook errors in navbar interactions.
    }
  }, []);

  useEffect(() => {
    if (!notifOpen) return;
    fetchNotifications();
  }, [notifOpen, fetchNotifications]);

  useEffect(() => {
    fetchNotifications();
    const id = setInterval(fetchNotifications, refreshIntervalMs);
    return () => clearInterval(id);
  }, [fetchNotifications]);

  useEffect(() => {
    fetchMachineAlerts();
    const id = setInterval(fetchMachineAlerts, refreshIntervalMs);
    return () => clearInterval(id);
  }, [fetchMachineAlerts]);

  useEffect(() => {
    if (!canTrainingOps) return undefined;
    fetchTrainingAlerts();
    const id = setInterval(fetchTrainingAlerts, refreshIntervalMs);
    return () => clearInterval(id);
  }, [canTrainingOps, fetchTrainingAlerts]);

  useEffect(() => {
    loadSlaStatus();
    if (!canSlaOps) return undefined;
    const id = setInterval(loadSlaStatus, 30000);
    return () => clearInterval(id);
  }, [canSlaOps, loadSlaStatus]);

  const handleRunSlaScan = useCallback(async () => {
    setRunningSla(true);
    try {
      const res = await runWorkflowSlaScan();
      const next = {
        pending: slaStatus?.pending ?? 0,
        breached: slaStatus?.breached ?? 0,
        updatedAt: new Date().toISOString(),
        lastScanAt: res?.ranAt || new Date().toISOString(),
        escalationsL1: res?.result?.workforce?.escalationsL1 ?? 0,
        escalationsL2: res?.result?.workforce?.escalationsL2 ?? 0,
      };
      setSlaStatus(next);
      localStorage.setItem("workflow_sla_last_scan", JSON.stringify(next));
      await loadSlaStatus();
    } finally {
      setRunningSla(false);
    }
  }, [loadSlaStatus, slaStatus?.breached, slaStatus?.pending]);

  useEffect(() => {
    setProfileOpen(false);
    setNotifOpen(false);
    setSearch("");
  }, [location.pathname]);

  useEffect(() => {
    const onClick = (e) => {
      if (!profileOpen) return;
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [profileOpen]);

  return (
    <header className="navbar">
      <div className="navbar-left">
        <button type="button"
          className="icon-btn"
          onClick={onToggleSidebar}
          aria-label="Open navigator"
          title="Navigator"
        >
          <Icon name="menu" />
        </button>

        <button type="button"
          className="brand-btn"
          onClick={() => navigate(isGuest ? "/guest" : homePath)}
        >
          {logo ? (
            <span className="brand-logo" style={{ backgroundImage: `url(${logo})` }} />
          ) : (
            "AfyaLink HCM"
          )}
        </button>

        <button type="button"
          className="icon-btn ghost"
          onClick={() => navigate(homePath)}
          aria-label="Home"
          title="Home"
        >
          <Icon name="home" />
          Home
        </button>
      </div>

      <div className="navbar-center">
        <div className="search-wrap">
          <input
            className="search-input"
            placeholder="Search people, tasks, reports, help"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="button"
            className="search-btn"
            onClick={() => setSearch("")}
            aria-label="Clear search"
            title="Clear"
          >
            Clear
          </button>

          {(results.length > 0 || searching) && (
            <div className="search-results">
              {searching && (
                <div className="search-result">
                  <span className="result-title">Searching...</span>
                </div>
              )}
              {results.map((item) => (
                <button type="button"
                  key={`${item.path}-${item.label}`}
                  className="search-result"
                  onClick={() => {
                    navigate(item.path);
                    setSearch("");
                  }}
                >
                  <span className="result-title">{item.label}</span>
                  <span className="result-path">{item.path}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="navbar-right">
        {isRoleOverrideActive && (
          <div className="override-mode-wrap">
            <span
              className="override-mode-badge"
              title={`Actual role: ${user.actualRole}`}
            >
              Override Mode: {strictImpersonation ? "Strict" : "Full Access"} • Viewing as: {user.role}
            </span>
            <button
              className="override-help"
              type="button"
              aria-label="Override mode help"
              title="Override mode help"
              data-tip={
                strictImpersonation
                  ? "Strict impersonation active: actions are limited to the selected role permissions."
                  : "Override active: all actions execute with founder/developer full permissions."
              }
            >
              ?
            </button>
          </div>
        )}
        {canSlaOps && (
          <div className="sla-status-wrap">
            <span
              className={`sla-status-chip ${
                (slaStatus?.breached || 0) > 0 ? "risk" : "ok"
              }`}
              title={`Pending: ${slaStatus?.pending ?? 0}, Breached: ${
                slaStatus?.breached ?? 0
              }`}
            >
              SLA {slaStatus?.breached ? `Breached ${slaStatus.breached}` : "Healthy"}
            </span>
            <button type="button"
              className="icon-btn ghost"
              disabled={runningSla}
              onClick={handleRunSlaScan}
              title={
                slaStatus?.lastScanAt
                  ? `Last scan: ${new Date(slaStatus.lastScanAt).toLocaleString()}`
                  : "Run Workflow SLA Scan"
              }
            >
              {runningSla ? "Scanning..." : "Scan SLA"}
            </button>
          </div>
        )}
        <button
          type="button"
          className={`sla-status-chip ${machineAlertCount > 0 ? "risk" : "ok"}`}
          title={
            machineAlertCount > 0
              ? `${machineAlertCount} unread machine/integration alerts`
              : "No unread machine alerts"
          }
          onClick={() => {
            setNotifOpen(false);
            navigate(
              canMachineOps
                ? "/hospital-admin/machine-alerts"
                : "/notifications?category=INTEGRATION&read=UNREAD&q=machine"
            );
          }}
        >
          Machines {machineAlertCount || machineUnreadFromCurrent || 0}
        </button>
        {canTrainingOps && (
          <button
            type="button"
            className={`sla-status-chip ${trainingAlertCount > 0 ? "risk" : "ok"}`}
            title={
              trainingAlertCount > 0
                ? `${trainingAlertCount} unread overdue training alerts`
                : "No unread training alerts"
            }
            onClick={() => {
              setNotifOpen(false);
              navigate("/admin/training-tracker?overdue=1");
            }}
          >
            Training {trainingAlertCount || trainingUnreadFromCurrent || 0}
          </button>
        )}
        <div className="profile-wrap">
          <button type="button"
            className="icon-btn ghost"
            title="Notifications"
            onClick={async () => {
              await safeTrigger("OPEN_NOTIFICATIONS");
              setNotifOpen((v) => !v);
            }}
          >
            <Icon name="bell" />
            Alerts
            {unreadCount > 0 && (
              <span className="notif-badge">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
          {notifOpen && (
            <div className="notif-menu">
              <div className="notif-head">
                <span>Notifications</span>
                <button type="button"
                  className="notif-close"
                  onClick={() => setNotifOpen(false)}
                  aria-label="Close notifications"
                >
                  ×
                </button>
              </div>
              {canSlaOps && (
                <div className="sla-mini">
                  <div className="sla-mini-row">
                    <strong>SLA Control</strong>
                    <span className={slaStatus?.breached ? "text-danger" : ""}>
                      {slaStatus?.breached
                        ? `${slaStatus.breached} breached`
                        : "No breaches"}
                    </span>
                  </div>
                  <div className="sla-mini-meta">
                    Last scan:{" "}
                    {slaStatus?.lastScanAt
                      ? new Date(slaStatus.lastScanAt).toLocaleString()
                      : "Never"}
                  </div>
                  <div className="sla-mini-actions">
                    <button type="button"
                      className="btn-secondary"
                      onClick={() => {
                        setNotifOpen(false);
                        navigate("/hospital-admin/approvals?view=breached#pending");
                      }}
                    >
                      Open Breaches
                    </button>
                    <button type="button"
                      className="btn-secondary"
                      onClick={() => {
                        setNotifOpen(false);
                        navigate("/hospital-admin/approvals#sla");
                      }}
                    >
                      SLA Policies
                    </button>
                    <button type="button"
                      className="btn-secondary"
                      disabled={runningSla}
                      onClick={handleRunSlaScan}
                    >
                      {runningSla ? "Scanning..." : "Scan Now"}
                    </button>
                  </div>
                </div>
              )}
              <div className="notif-filters">
                <select
                  value={notifCategory}
                  onChange={(e) => setNotifCategory(e.target.value)}
                >
                  <option value="ALL">All Categories</option>
                  <option value="WORKFORCE">Workforce</option>
                  <option value="SECURITY">Security</option>
                  <option value="BILLING">Billing</option>
                  <option value="SYSTEM">System</option>
                  <option value="INTEGRATION">Integration</option>
                  <option value="AI">AI</option>
                  <option value="TRAINING">Training</option>
                </select>
                <select
                  value={notifRead}
                  onChange={(e) => setNotifRead(e.target.value)}
                >
                  <option value="ALL">All Status</option>
                  <option value="UNREAD">Unread</option>
                  <option value="READ">Read</option>
                </select>
                <button type="button"
                  className="btn-secondary"
                  onClick={async () => {
                    try {
                      await markAllNotificationsRead();
                      setNotifItems((prev) => prev.map((n) => ({ ...n, read: true })));
                    } catch {
                      // Keep current list if API mark-all fails.
                    }
                  }}
                >
                  Mark all read
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setNotifOpen(false);
                    navigate(
                      canMachineOps
                        ? "/hospital-admin/machine-alerts"
                        : "/notifications?category=INTEGRATION&read=UNREAD&q=machine"
                    );
                  }}
                >
                  Machine Alerts
                </button>
              </div>
              <div className="notif-list">
                {notifItems.slice(0, 6).map((n) => (
                  <div key={n._id} className="notif-item">
                    <div className="notif-title">
                      {n.title || "Notification"}
                      {!n.read && <span className="badge-dot">!</span>}
                    </div>
                    <div className="notif-body">{n.body || "-"}</div>
                    <div className="notif-actions">
                      {n?.meta?.path && canOpenNotificationPath(n.meta.path) ? (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => {
                            setNotifOpen(false);
                            navigate(String(n.meta.path));
                          }}
                        >
                          Open
                        </button>
                      ) : null}
                      <button type="button"
                        className="btn-secondary"
                        onClick={async () => {
                          try {
                            if (n.read) {
                              await markNotificationUnread(n._id);
                              setNotifItems((prev) =>
                                prev.map((item) =>
                                  item._id === n._id ? { ...item, read: false } : item
                                )
                              );
                            } else {
                              await markNotificationRead(n._id);
                              setNotifItems((prev) =>
                                prev.map((item) =>
                                  item._id === n._id ? { ...item, read: true } : item
                                )
                              );
                            }
                          } catch {
                            // Keep existing state if mark call fails.
                          }
                        }}
                      >
                        {n.read ? "Mark unread" : "Mark read"}
                      </button>
                    </div>
                  </div>
                ))}
                {notifItems.length === 0 && (
                  <div className="muted">No notifications</div>
                )}
              </div>
              <button type="button"
                className="notif-link"
                onClick={() => {
                  setNotifOpen(false);
                  navigate("/notifications");
                }}
              >
                View All Notifications
              </button>
            </div>
          )}
        </div>
        {isDoctorRole && (
          <button type="button"
            className="icon-btn ghost"
            title="Quick Calendar"
            onClick={() => navigate("/doctor/schedule")}
          >
            <Icon name="calendar" />
            Calendar
          </button>
        )}
        {isDoctorRole && (
          <button type="button"
            className="icon-btn danger-soft"
            title="Emergency Alert"
            onClick={async () => {
              await triggerAction("EMERGENCY_ALERT");
              navigate("/doctor/ward");
            }}
          >
            <Icon name="emergency" />
            Emergency
          </button>
        )}
        <button type="button"
          className="icon-btn ghost"
          title="Messages"
          onClick={async () => {
            await safeTrigger("OPEN_MESSAGES");
            navigate("/ai/chatbot");
          }}
        >
          <Icon name="chat" />
          Messages
        </button>
        <button type="button"
          className="icon-btn ghost"
          title="Theme"
          onClick={async () => {
            await safeTrigger("TOGGLE_THEME");
            cycleTheme();
          }}
        >
          <Icon name="sun" />
          {theme === "system" ? "System" : theme === "dark" ? "Dark" : "Light"}
        </button>
        <div className="profile-wrap" ref={profileRef}>
          <button type="button"
            className="profile-btn"
            onClick={() => setProfileOpen((v) => !v)}
          >
            <span className="avatar">{user?.name?.[0] || "U"}</span>
            <span className="profile-meta">
              <span className="profile-name">{user?.name || "User"}</span>
              <span className="profile-role">{user?.role || "User"}</span>
            </span>
          </button>

          {profileOpen && (
            <div className="profile-menu">
              <div className="profile-menu-head">
                <span>Profile</span>
                <button type="button"
                  className="notif-close"
                  onClick={() => setProfileOpen(false)}
                  aria-label="Close profile menu"
                >
                  ×
                </button>
              </div>
              <button type="button" onClick={() => navigate("/profile")}>
                My Profile
              </button>
              <button type="button" onClick={() => navigate("/profile")}>
                Preferences
              </button>
              <button type="button" onClick={() => navigate("/reports")}>
                About AfyaLink
              </button>
              {!isGuest ? (
                <button type="button" className="danger" onClick={logout}>
                  Sign Out
                </button>
              ) : (
                <button type="button" onClick={() => navigate("/register")}>
                  Upgrade
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
