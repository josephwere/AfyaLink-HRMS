import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../utils/auth";
import { redirectByRole } from "../utils/redirectByRole";
import { normalizeRole } from "../utils/normalizeRole";
import { useSystemSettings } from "../utils/systemSettings.jsx";
import { useAppLanguage } from "../utils/appLanguage.jsx";
import { useUiPreferences } from "../utils/uiPreferences";
import { settingsPathForRole } from "../utils/workspaceNavigation";
import { prefetchRouteByPath } from "../utils/routePrefetch";
import { listNotifications } from "../services/notificationsApi";
import { workspacesForUser, navForWorkspace, WORKSPACE_HOME_PATH } from "../app/navigation/workspaces";
import { LEGACY_ROUTE_MAP } from "../app/routing/legacyRouteMap";

import LegalLinks from "./LegalLinks";

const RECENT_LIMIT = 6;
const SIDEBAR_DEFAULT_WIDTH = 300;
const SIDEBAR_MIN_WIDTH = 280;
const SIDEBAR_MAX_WIDTH = 380;

function NavIcon({ name }) {
  const { settings } = useSystemSettings();
  const icons = {
    home: "🏠",
    admin: "🛡️",
    hr: "👥",
    payroll: "💳",
    doctor: "🧑‍⚕️",
    nurse: "👩‍⚕️",
    lab: "🧪",
    pharmacy: "💊",
    staff: "🧑‍💼",
    security: "🔐",
    settings: "⚙️",
    analytics: "📊",
    reports: "📄",
    notifications: "🔔",
    requests: "📝",
    inventory: "📦",
    ai: "🤖",
    appointments: "📅",
    printer: "🖨️",
    shield: "🛡️",
    account: "👤",
    star: "★",
    search: "⌘",
  };

  const custom = settings?.branding?.sidebarIcons?.[name];

  return (
    <span className="nav-icon" aria-hidden="true">
      {custom ? <img className="nav-icon-img" src={custom} alt="" /> : icons[name] || "•"}
    </span>
  );
}

function dedupeByPath(items = []) {
  const seen = new Set();
  return (items || []).filter((item) => {
    const key = String(item?.path || "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function scopedStorageKey(prefix, user) {
  const scope = user?.id || user?.email || user?.role || "anonymous";
  return `${prefix}_${scope}`;
}

function readStoredJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeStoredJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota failures for navigation preferences.
  }
}

function readRecentItems(user) {
  const parsed = readStoredJson(scopedStorageKey("afyalink_sidebar_recent", user), []);
  return Array.isArray(parsed) ? parsed : [];
}

function writeRecentItems(user, items) {
  writeStoredJson(scopedStorageKey("afyalink_sidebar_recent", user), items.slice(0, RECENT_LIMIT));
}

function readStarredPaths(user) {
  const parsed = readStoredJson(scopedStorageKey("afyalink_sidebar_starred", user), []);
  return Array.isArray(parsed) ? parsed : [];
}

function writeStarredPaths(user, paths) {
  writeStoredJson(scopedStorageKey("afyalink_sidebar_starred", user), paths);
}

function readSidebarWidth(user) {
  const value = Number(localStorage.getItem(scopedStorageKey("afyalink_sidebar_width", user)));
  if (!Number.isFinite(value)) return SIDEBAR_DEFAULT_WIDTH;
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, value));
}

function writeSidebarWidth(user, value) {
  try {
    localStorage.setItem(scopedStorageKey("afyalink_sidebar_width", user), String(value));
  } catch {
    // Ignore storage failures for width preference.
  }
}

function isActivePath(currentPath, targetPath) {
  const current = String(currentPath || "").replace(/\/+$/, "") || "/";
  const target = String(targetPath || "").replace(/\/+$/, "") || "/";
  if (target === "/") return current === "/";
  return (
    current === target ||
    current.startsWith(`${target}/`) ||
    current.startsWith(`${target}#`) ||
    current.startsWith(`${target}?`)
  );
}

function workspaceFromPath(pathname) {
  const path = String(pathname || "");
  const match = path.match(/^\/app\/([^/]+)/);
  return match ? match[1] : "";
}

function canonicalizeStoredPath(rawPath) {
  const raw = String(rawPath || "").trim();
  if (!raw) return "";
  if (raw.startsWith("/app/")) return raw;

  const [pathname, query = ""] = raw.split("?");
  const mapped = LEGACY_ROUTE_MAP?.[pathname];
  if (!mapped) return raw;
  return query ? `${mapped}?${query}` : mapped;
}

export default function Sidebar({ open = true, onClose }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { settings } = useSystemSettings();
  const { translateText } = useAppLanguage();
  const { uiPreferences, setUiPreferences } = useUiPreferences();

  const hospitalModules = settings?.hospitalCustomization?.modules || {};
  const showAI = hospitalModules.showAI !== false;
  const showReports = hospitalModules.showReports !== false;
  const showAnalytics = hospitalModules.showAnalytics !== false;

  const [recentItems, setRecentItems] = useState([]);
  const [starredPaths, setStarredPaths] = useState([]);
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const [pharmacyRiskAlertCount, setPharmacyRiskAlertCount] = useState(0);

  const effectiveRole = normalizeRole(user?.role || "");
  const navigationPrefs = uiPreferences?.navigation || {};

  const workspaces = useMemo(() => {
    const list = workspacesForUser(user);
    if (!showAI) return list.filter((ws) => ws.id !== "innovation");
    return list;
  }, [showAI, user]);

  const activeWorkspaceId = useMemo(() => {
    const id = workspaceFromPath(location.pathname);
    const allowed = new Set(workspaces.map((ws) => ws.id));
    if (id && allowed.has(id)) return id;
    return workspaces[0]?.id || "platform";
  }, [location.pathname, workspaces]);

  const activeNavGroups = useMemo(() => {
    const allowItem = (item) => {
      const path = String(item?.path || "");
      if (!path) return false;
      if (!showAI && path.startsWith("/app/innovation")) return false;
      if (!showReports && path.startsWith("/app/platform/reports")) return false;
      if (!showAnalytics && path.startsWith("/app/platform/analytics")) return false;
      return true;
    };

    return (navForWorkspace(activeWorkspaceId) || [])
      .map((group) => ({
        ...group,
        items: (group.items || []).filter(allowItem),
      }))
      .filter((group) => group?.slot !== "global")
      .filter((group) => (group.items || []).length > 0);
  }, [activeWorkspaceId, showAI, showAnalytics, showReports]);

  const canPharmacyOps = [
    "SUPER_ADMIN",
    "SYSTEM_ADMIN",
    "DEVELOPER",
    "HOSPITAL_ADMIN",
    "HOSPITAL_ADMIN_ASSISTANT",
    "PHARMACIST",
  ].includes(effectiveRole);

  useEffect(() => {
    if (!user) return;
    const storedRecent = Array.isArray(navigationPrefs?.recentItems)
      ? navigationPrefs.recentItems
      : readRecentItems(user);
    setRecentItems(
      (Array.isArray(storedRecent) ? storedRecent : [])
        .map((item) => ({ ...(item || {}), path: canonicalizeStoredPath(item?.path) }))
        .filter((item) => item?.path)
    );

    const storedStarred = Array.isArray(navigationPrefs?.starredPaths)
      ? navigationPrefs.starredPaths
      : readStarredPaths(user);
    setStarredPaths(
      (Array.isArray(storedStarred) ? storedStarred : [])
        .map((path) => canonicalizeStoredPath(path))
        .filter(Boolean)
    );
    setSidebarWidth(
      Number.isFinite(Number(navigationPrefs?.sidebarWidth))
        ? Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Number(navigationPrefs.sidebarWidth)))
        : readSidebarWidth(user)
    );
  }, [navigationPrefs?.recentItems, navigationPrefs?.sidebarWidth, navigationPrefs?.starredPaths, user]);

  useEffect(() => {
    if (!user) return;
    writeStarredPaths(user, starredPaths);
    setUiPreferences({
      navigation: {
        ...(uiPreferences?.navigation || {}),
        starredPaths,
      },
    });
  }, [setUiPreferences, starredPaths, uiPreferences?.navigation, user]);

  useEffect(() => {
    if (!user) return;
    writeSidebarWidth(user, sidebarWidth);
    setUiPreferences({
      navigation: {
        ...(uiPreferences?.navigation || {}),
        sidebarWidth,
      },
    });
  }, [setUiPreferences, sidebarWidth, uiPreferences?.navigation, user]);

  useEffect(() => {
    if (!canPharmacyOps) {
      setPharmacyRiskAlertCount(0);
      return undefined;
    }

    const refresh = () => {
      listNotifications({ query: "category=PHARMACY&read=false&limit=120" })
        .then((data) => {
          const rows = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
          const count = rows.filter(
            (n) => String(n?.meta?.type || "").toUpperCase() === "PHARMACY_COVERAGE_RISK"
          ).length;
          setPharmacyRiskAlertCount(count);
        })
        .catch(() => setPharmacyRiskAlertCount(0));
    };

    refresh();
    const id = setInterval(refresh, 15000);
    return () => clearInterval(id);
  }, [canPharmacyOps]);

  const handleSelect = useCallback(
    (item) => {
      const next = dedupeByPath([item, ...recentItems]).slice(0, RECENT_LIMIT);
      setRecentItems(next);
      writeRecentItems(user, next);
      setUiPreferences({
        navigation: {
          ...(uiPreferences?.navigation || {}),
          recentItems: next,
        },
      });
      navigate(item.path);
      onClose?.();
    },
    [navigate, onClose, recentItems, setUiPreferences, uiPreferences?.navigation, user]
  );

  const toggleStarred = useCallback((item) => {
    setStarredPaths((prev) =>
      prev.includes(item.path) ? prev.filter((path) => path !== item.path) : [...prev, item.path]
    );
  }, []);

  const startResize = useCallback(
    (event) => {
      if (window.innerWidth <= 1024) return;
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = sidebarWidth;

      const onMove = (moveEvent) => {
        const next = Math.min(
          SIDEBAR_MAX_WIDTH,
          Math.max(SIDEBAR_MIN_WIDTH, startWidth + (moveEvent.clientX - startX))
        );
        setSidebarWidth(next);
      };

      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [sidebarWidth]
  );

  const openGlobalSearch = () => {
    window.dispatchEvent(new CustomEvent("afyalink:open-command-palette"));
    onClose?.();
  };

  const allKnownItems = useMemo(() => {
    const allowItem = (item) => {
      const path = String(item?.path || "");
      if (!path) return false;
      if (!showAI && path.startsWith("/app/innovation")) return false;
      if (!showReports && path.startsWith("/app/platform/reports")) return false;
      if (!showAnalytics && path.startsWith("/app/platform/analytics")) return false;
      return true;
    };

    const navItems = workspaces
      .flatMap((ws) => (navForWorkspace(ws.id) || []).flatMap((group) => group.items || []))
      .filter(allowItem);

    // Cross-cutting destinations (these are not tied to a single workspace module list).
    const utilityItems = [
      { label: "Profile", path: "/app/platform/account/profile", icon: "account" },
      { label: "Notifications", path: "/app/platform/inbox/notifications", icon: "notifications" },
      { label: "Communication Center", path: "/app/platform/inbox/communication", icon: "notifications" },
    ];

    return dedupeByPath([...navItems, ...utilityItems]);
  }, [showAI, showAnalytics, showReports, workspaces]);

  const starredVisible = useMemo(() => {
    const itemByPath = new Map(allKnownItems.map((item) => [item.path, item]));
    return starredPaths.map((path) => itemByPath.get(path)).filter(Boolean);
  }, [allKnownItems, starredPaths]);

  const recentVisible = useMemo(() => {
    const itemByPath = new Map(allKnownItems.map((item) => [item.path, item]));
    const resolved = recentItems.map((item) => itemByPath.get(item.path)).filter(Boolean);
    return dedupeByPath(resolved);
  }, [allKnownItems, recentItems]);

  if (!user) return null;

  return (
    <aside
      className={`sidebar ${open ? "is-open" : "collapsed"}`}
      style={{ "--sidebar-width": `${sidebarWidth}px` }}
      onWheel={(event) => event.stopPropagation()}
    >
      <div className="sidebar-scroll">
        <div className="sidebar-workspace-shell">
          <div className="sidebar-search-label">{translateText("Workspace")}</div>
          <select
            className="sidebar-workspace-select"
            value={activeWorkspaceId}
            onChange={(e) => {
              const next = e.target.value;
              const path = WORKSPACE_HOME_PATH?.[next] || redirectByRole(user);
              navigate(path);
              onClose?.();
            }}
            aria-label={translateText("Workspace switcher")}
          >
            {workspaces.map((ws) => (
              <option key={ws.id} value={ws.id}>
                {ws.label}
              </option>
            ))}
          </select>
        </div>

        <div className="sidebar-search-shell">
          <div className="sidebar-search-label">{translateText("Global actions")}</div>
          <button
            type="button"
            className="sidebar-command-button"
            onClick={openGlobalSearch}
            title={translateText("Open command palette (Ctrl+K)")}
            aria-label={translateText("Open command palette")}
          >
            <NavIcon name="search" />
            <span>
              {translateText("Open command palette")} <span className="muted">Ctrl+K</span>
            </span>
          </button>
        </div>

        {starredVisible.length > 0 ? (
          <SidebarCluster title="Starred" hint={`${starredVisible.length} items`}>
            {starredVisible.map((item) => (
              <SidebarItem
                key={`starred-${item.path}`}
                item={item}
                active={isActivePath(location.pathname, item.path)}
                onSelect={handleSelect}
                isStarred
                onToggleStar={toggleStarred}
              />
            ))}
          </SidebarCluster>
        ) : null}

        {recentVisible.length > 0 ? (
          <SidebarCluster title="Recent" hint={`${recentVisible.length} items`}>
            {recentVisible.map((item) => (
              <SidebarItem
                key={`recent-${item.path}`}
                item={item}
                active={isActivePath(location.pathname, item.path)}
                onSelect={handleSelect}
                isStarred={starredPaths.includes(item.path)}
                onToggleStar={toggleStarred}
              />
            ))}
          </SidebarCluster>
        ) : null}

        {activeNavGroups.map((group) => (
          <SidebarCluster key={group.group} title={group.group} hint={`${(group.items || []).length} tools`}>
            {(group.items || []).map((item) => (
              <SidebarItem
                key={`${group.group}-${item.path}`}
                item={item}
                active={isActivePath(location.pathname, item.path)}
                onSelect={handleSelect}
                badge={
                  item.path === "/app/platform/inbox/notifications" && pharmacyRiskAlertCount > 0
                    ? String(pharmacyRiskAlertCount)
                    : item.badge
                }
                isStarred={starredPaths.includes(item.path)}
                onToggleStar={toggleStarred}
              />
            ))}
          </SidebarCluster>
        ))}

        {activeNavGroups.length === 0 ? (
          <div className="sidebar-empty-note">{translateText("No tools are available in this workspace yet.")}</div>
        ) : null}
      </div>

      <div className="sidebar-footer sticky-footer">
        <div className="sidebar-utility-rail" aria-label={translateText("Account shortcuts")}>
          <button
            type="button"
            className="nav-btn sidebar-utility-btn"
            onClick={() => {
              navigate("/app/platform/inbox/notifications");
              onClose?.();
            }}
          >
            <NavIcon name="notifications" />
            {translateText("Notifications")}
            {pharmacyRiskAlertCount > 0 ? <span className="notif-badge">{pharmacyRiskAlertCount}</span> : null}
          </button>
          <button
            type="button"
            className="nav-btn sidebar-utility-btn"
            onClick={() => {
              navigate("/app/platform/account/profile");
              onClose?.();
            }}
          >
            <NavIcon name="account" />
            {translateText("Profile")}
          </button>
          <button
            type="button"
            className="nav-btn sidebar-utility-btn"
            onClick={() => {
              navigate(settingsPathForRole(effectiveRole));
              onClose?.();
            }}
          >
            <NavIcon name="settings" />
            {translateText("Settings")}
          </button>
        </div>
        <button
          type="button"
          className="nav-btn sidebar-signout-btn"
          onClick={() => {
            logout();
            onClose?.();
          }}
        >
          <NavIcon name="security" />
          {translateText("Sign Out")}
        </button>
        <LegalLinks compact className="sidebar-legal-links" />
      </div>

      <button
        type="button"
        className="sidebar-resize-handle"
        onMouseDown={startResize}
        aria-label="Resize sidebar"
      />
    </aside>
  );
}

function SidebarCluster({ title, hint = "", children }) {
  const { translateText } = useAppLanguage();
  return (
    <section className="sidebar-cluster">
      <div className="sidebar-cluster-head">
        <div className="sidebar-cluster-title">{translateText(title)}</div>
        {hint ? <span className="sidebar-cluster-hint">{translateText(hint)}</span> : null}
      </div>
      <div className="sidebar-cluster-list">{children}</div>
    </section>
  );
}

function SidebarItem({ item, active, onSelect, badge = "", isStarred = false, onToggleStar = null }) {
  const { translateText } = useAppLanguage();
  return (
    <div
      className={`nav-btn sidebar-nav-btn ${active ? "active" : ""}`.trim()}
      onClick={() => onSelect(item)}
      onMouseEnter={() => prefetchRouteByPath(item?.path)}
      onFocus={() => prefetchRouteByPath(item?.path)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onSelect(item);
      }}
    >
      <NavIcon name={item.icon || "admin"} />
      <span className="sidebar-nav-copy">{translateText(item.label)}</span>
      {badge ? <span className="notif-badge">{translateText(badge)}</span> : null}
      {typeof onToggleStar === "function" ? (
        <button
          type="button"
          className={`sidebar-star-btn ${isStarred ? "active" : ""}`.trim()}
          onClick={(event) => {
            event.stopPropagation();
            onToggleStar(item);
          }}
          aria-label={isStarred ? translateText("Remove from starred") : translateText("Add to starred")}
        >
          {isStarred ? "★" : "☆"}
        </button>
      ) : null}
    </div>
  );
}
