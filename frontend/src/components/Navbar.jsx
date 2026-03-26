import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../utils/auth";
import { redirectByRole } from "../utils/redirectByRole";
import { useTheme } from "../utils/theme.jsx";
import { triggerAction } from "../services/actionApi";
import { useSystemSettings } from "../utils/systemSettings.jsx";
import { useAppLanguage } from "../utils/appLanguage.jsx";
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
    megaphone: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M4 13V11a2 2 0 0 1 2-2h2l8-4v14l-8-4H6a2 2 0 0 1-2-2Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M10 15.5 11.5 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
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
    search: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M16.5 16.5 21 21" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  };

  return <span className="icon">{icons[name] || null}</span>;
}

export default function Navbar({ onToggleSidebar }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { cycleTheme } = useTheme();
  const { settings } = useSystemSettings();
  const { translateText } = useAppLanguage();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifItems, setNotifItems] = useState([]);
  const [notifCategory, setNotifCategory] = useState("ALL");
  const [notifRead, setNotifRead] = useState("ALL");
  const [transferStatus, setTransferStatus] = useState(
    localStorage.getItem("afyalink_transfer_status") || ""
  );
  const [transferScope, setTransferScope] = useState(
    localStorage.getItem("afyalink_transfer_scope") || ""
  );
  const refreshIntervalMs = 15000;
  const logo = settings?.branding?.logo;
  const profileRef = useRef(null);

  const isGuest = user?.role === "GUEST";
  const currentRole = String(user?.role || "").toUpperCase();
  const homePath = user ? redirectByRole(user) : "/";
  const showTransferFilters = useMemo(() => {
    const path = String(location.pathname || "").toLowerCase();
    return path.includes("transfer");
  }, [location.pathname]);

  const unreadCount = useMemo(
    () => notifItems.filter((n) => !n.read).length,
    [notifItems]
  );

  const canOpenNotificationPath = useCallback(
    (path) => {
      const p = String(path || "").trim();
      if (!p) return false;

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
    [currentRole]
  );

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

  const safeTrigger = useCallback(async (action) => {
    try {
      await triggerAction(action);
    } catch {
      // Ignore telemetry/action hook errors in navbar interactions.
    }
  }, []);

  const openCommandPalette = useCallback(async () => {
    await safeTrigger("OPEN_COMMAND_PALETTE");
    window.dispatchEvent(new CustomEvent("afyalink:open-command-palette"));
  }, [safeTrigger]);

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
    setProfileOpen(false);
    setNotifOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    localStorage.setItem("afyalink_transfer_status", transferStatus);
  }, [transferStatus]);

  useEffect(() => {
    localStorage.setItem("afyalink_transfer_scope", transferScope);
  }, [transferScope]);

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
      </div>

      <div className="navbar-center">
        {showTransferFilters ? (
          <div className="transfer-filter">
            <select
              value={transferStatus}
              onChange={(e) => setTransferStatus(e.target.value)}
              aria-label="Transfer status filter"
            >
              <option value="">All statuses</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="Completed">Completed</option>
            </select>
            <select
              value={transferScope}
              onChange={(e) => setTransferScope(e.target.value)}
              aria-label="Transfer scope filter"
            >
              <option value="">Facility scope</option>
              <option value="from">Outbound</option>
              <option value="to">Inbound</option>
              <option value="mine">My requests</option>
              <option value="global">Global</option>
            </select>
          </div>
        ) : null}
      </div>

      <div className="navbar-right">
        {user ? (
          <button
            type="button"
            className="icon-btn ghost"
            title={translateText("Command palette (Ctrl+K)")}
            aria-label={translateText("Open command palette")}
            onClick={openCommandPalette}
          >
            <Icon name="search" />
          </button>
        ) : null}
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
                  <option value="PHARMACY">Pharmacy</option>
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
        <button type="button"
          className="icon-btn ghost"
          title="Theme"
          onClick={async () => {
            await safeTrigger("TOGGLE_THEME");
            cycleTheme();
          }}
        >
          <Icon name="sun" />
        </button>
        <div className="profile-wrap" ref={profileRef}>
          <button type="button"
            className="profile-btn"
            onClick={() => setProfileOpen((v) => !v)}
          >
            <span className="avatar">{user?.name?.[0] || "U"}</span>
            <span className="profile-meta">
              <span className="profile-name">{user?.name || "User"}</span>
              <span className="profile-role">{translateText(String(user?.role || "User"))}</span>
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
              <button type="button" onClick={() => navigate("/ai/chatbot")}>
                Messages
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
