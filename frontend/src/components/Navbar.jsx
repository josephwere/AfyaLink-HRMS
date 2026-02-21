import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../utils/auth";
import { redirectByRole } from "../utils/redirectByRole";
import { getSearchCatalog } from "../config/searchCatalog";
import { useTheme } from "../utils/theme.jsx";
import { triggerAction } from "../services/actionApi";
import { useSystemSettings } from "../utils/systemSettings.jsx";
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
  const { user, logout, roleOverride } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, cycleTheme } = useTheme();
  const { settings } = useSystemSettings();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifItems, setNotifItems] = useState([]);
  const [notifCategory, setNotifCategory] = useState("ALL");
  const [notifRead, setNotifRead] = useState("ALL");
  const [search, setSearch] = useState("");
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
  const homePath = user ? redirectByRole(user) : "/";

  const catalog = useMemo(() => getSearchCatalog(user), [user]);
  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return catalog
      .filter((item) => item.label.toLowerCase().includes(q))
      .slice(0, 8);
  }, [search, catalog]);

  const unreadCount = useMemo(
    () => notifItems.filter((n) => !n.read).length,
    [notifItems]
  );
  const isRoleOverrideActive =
    Boolean(roleOverride) &&
    Boolean(user?.actualRole) &&
    user.actualRole !== user.role;
  const canSlaOps = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(
    user?.role
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
        <button
          className="icon-btn"
          onClick={onToggleSidebar}
          aria-label="Open navigator"
          title="Navigator"
        >
          <Icon name="menu" />
        </button>

        <button
          className="brand-btn"
          onClick={() => navigate(isGuest ? "/guest" : homePath)}
        >
          {logo ? (
            <span className="brand-logo" style={{ backgroundImage: `url(${logo})` }} />
          ) : (
            "AfyaLink HCM"
          )}
        </button>

        <button
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
          <button
            className="search-btn"
            onClick={() => setSearch("")}
            aria-label="Clear search"
            title="Clear"
          >
            Clear
          </button>

          {results.length > 0 && (
            <div className="search-results">
              {results.map((item) => (
                <button
                  key={item.path}
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
              Override Mode: Full Access • Viewing as: {user.role}
            </span>
            <button
              className="override-help"
              type="button"
              aria-label="Override mode help"
              title="Override mode help"
              data-tip="Override active: all actions execute with full permissions of the selected role."
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
            <button
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
        <div className="profile-wrap">
          <button
            className="icon-btn ghost"
            title="Notifications"
            onClick={async () => {
              await triggerAction("OPEN_NOTIFICATIONS");
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
                <button
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
                    <button
                      className="btn-secondary"
                      onClick={() => {
                        setNotifOpen(false);
                        navigate("/hospital-admin/approvals?view=breached#pending");
                      }}
                    >
                      Open Breaches
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => {
                        setNotifOpen(false);
                        navigate("/hospital-admin/approvals#sla");
                      }}
                    >
                      SLA Policies
                    </button>
                    <button
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
                </select>
                <select
                  value={notifRead}
                  onChange={(e) => setNotifRead(e.target.value)}
                >
                  <option value="ALL">All Status</option>
                  <option value="UNREAD">Unread</option>
                  <option value="READ">Read</option>
                </select>
                <button
                  className="btn-secondary"
                  onClick={async () => {
                    await markAllNotificationsRead();
                    setNotifItems((prev) => prev.map((n) => ({ ...n, read: true })));
                  }}
                >
                  Mark all read
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
                      <button
                        className="btn-secondary"
                        onClick={async () => {
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
              <button
                className="notif-link"
                onClick={() => {
                  setNotifOpen(false);
                  navigate("/admin/notifications");
                }}
              >
                View All Notifications
              </button>
            </div>
          )}
        </div>
        {isDoctorRole && (
          <button
            className="icon-btn ghost"
            title="Quick Calendar"
            onClick={() => navigate("/doctor/schedule")}
          >
            <Icon name="calendar" />
            Calendar
          </button>
        )}
        {isDoctorRole && (
          <button
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
        <button
          className="icon-btn ghost"
          title="Messages"
          onClick={async () => {
            await triggerAction("OPEN_MESSAGES");
            navigate("/ai/chatbot");
          }}
        >
          <Icon name="chat" />
          Messages
        </button>
        <button
          className="icon-btn ghost"
          title="Help"
          onClick={async () => {
            await triggerAction("OPEN_HELP");
            navigate("/reports");
          }}
        >
          <Icon name="help" />
          Help
        </button>
        <button
          className="icon-btn ghost"
          title="Theme"
          onClick={async () => {
            await triggerAction("TOGGLE_THEME");
            cycleTheme();
          }}
        >
          <Icon name="sun" />
          {theme === "system" ? "System" : theme === "dark" ? "Dark" : "Light"}
        </button>
        <button
          className="icon-btn ghost"
          title="Settings"
          onClick={async () => {
            await triggerAction("OPEN_SETTINGS");
            navigate("/profile");
          }}
        >
          <Icon name="settings" />
          Settings
        </button>

        <div className="profile-wrap" ref={profileRef}>
          <button
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
                <button
                  className="notif-close"
                  onClick={() => setProfileOpen(false)}
                  aria-label="Close profile menu"
                >
                  ×
                </button>
              </div>
              <button onClick={() => navigate("/profile")}>
                My Profile
              </button>
              <button onClick={() => navigate("/profile")}>
                Preferences
              </button>
              <button onClick={() => navigate("/reports")}>
                About AfyaLink
              </button>
              {!isGuest ? (
                <button className="danger" onClick={logout}>
                  Sign Out
                </button>
              ) : (
                <button onClick={() => navigate("/register")}>
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
