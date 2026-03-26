import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../utils/auth";
import { fetchMenu, makeMenuCacheKey, readMenuCache, writeMenuCache } from "../services/menuApi";
import { redirectByRole } from "../utils/redirectByRole";
import { normalizeRole } from "../utils/normalizeRole";
import { useTheme } from "../utils/theme.jsx";
import { useSystemSettings } from "../utils/systemSettings.jsx";
import { useAppLanguage } from "../utils/appLanguage.jsx";
import { useUiPreferences } from "../utils/uiPreferences";
import { getQuickActionsForRole, settingsPathForRole } from "../utils/workspaceNavigation";
import { prefetchRouteByPath } from "../utils/routePrefetch";
import { listNotifications } from "../services/notificationsApi";
import { ROLE_VIEW_OPTIONS } from "../utils/roleViewOptions";
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

function matchesQuery(label, query, translateText) {
  if (!query) return true;
  const source = String(label || "").toLowerCase();
  const translated = String(translateText(label || "")).toLowerCase();
  return source.includes(query) || translated.includes(query);
}

function dedupeByPath(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    const key = String(item?.path || "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeSectionsByPath(sections = []) {
  const seen = new Set();
  return sections
    .map((section) => {
      const items = (section?.items || []).filter((item) => {
        const key = String(item?.path || "");
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return { ...section, items };
    })
    .filter((section) => (section?.items || []).length > 0);
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

function buildFallbackSections({ homePath, normalizedRole, showAI }) {
  return [
    {
      section: "Home",
      items: [
        { label: "Dashboard", path: homePath, icon: "home" },
        { label: "Profile", path: "/profile", icon: "account" },
        { label: "Notifications", path: "/notifications", icon: "notifications" },
        { label: "Reports", path: "/reports", icon: "reports" },
      ],
    },
    showAI
      ? {
          section: "AI",
          items: [
            { label: "Clinical Assistant", path: "/ai/medical", icon: "ai" },
            { label: "AI Chatbot", path: "/ai/chatbot", icon: "ai" },
          ],
        }
      : null,
    {
      section: "For You",
      items: getQuickActions(normalizedRole).map((item) => ({ ...item, icon: item.icon || "home" })),
    },
  ].filter(Boolean);
}

export default function Sidebar({ open = true, onClose }) {
  const {
    user,
    logout,
    roleOverride,
    strictImpersonation,
    setRoleOverride,
    setStrictImpersonation,
    canRoleOverride,
  } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { settings } = useSystemSettings();
  const { translateText } = useAppLanguage();
  const { uiPreferences, setUiPreferences } = useUiPreferences();

  const appName = settings?.branding?.appName || "AfyaLink";
  const appTagline = settings?.branding?.tagline || null;
  const hospitalModules = settings?.hospitalCustomization?.modules || {};
  const showAI = hospitalModules.showAI !== false;
  const showReports = hospitalModules.showReports !== false;
  const showAnalytics = hospitalModules.showAnalytics !== false;

  const [dynamicMenu, setDynamicMenu] = useState([]);
  const [menuLoaded, setMenuLoaded] = useState(false);
  const [navQuery, setNavQuery] = useState("");
  const [recentItems, setRecentItems] = useState([]);
  const [starredPaths, setStarredPaths] = useState([]);
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const [pharmacyRiskAlertCount, setPharmacyRiskAlertCount] = useState(0);
  const [viewRole, setViewRole] = useState("");

  const normalizedRole = normalizeRole(user?.role || "");
  const navigationPrefs = uiPreferences?.navigation || {};
  const homePath = user ? redirectByRole(user) : "/";
  const showRoleChip = user?.actualRole && user.actualRole !== user.role;
  const canPharmacyOps = [
    "SUPER_ADMIN",
    "SYSTEM_ADMIN",
    "DEVELOPER",
    "HOSPITAL_ADMIN",
    "HOSPITAL_ADMIN_ASSISTANT",
    "PHARMACIST",
  ].includes(normalizedRole);

  const allowMenuItem = useCallback(
    (item) => {
      const path = String(item?.path || "");
      if (!showAI && path.startsWith("/ai")) return false;
      if (!showReports && (path === "/reports" || path.startsWith("/reports"))) return false;
      if (!showAnalytics && (path === "/analytics" || path.startsWith("/analytics"))) return false;
      return true;
    },
    [showAI, showReports, showAnalytics]
  );

  useEffect(() => {
    if (!user) return;

    const cacheKey = makeMenuCacheKey({
      userId: user?.id,
      role: user?.actualRole || user?.role,
      viewRole: roleOverride || "",
    });
    const cachedMenu = readMenuCache(cacheKey);
    if (cachedMenu) {
      setDynamicMenu(cachedMenu);
      setMenuLoaded(true);
    }

    fetchMenu()
      .then((res) => {
        const menu = Array.isArray(res?.menu) ? res.menu : [];
        setDynamicMenu(menu);
        writeMenuCache(cacheKey, menu);
        setMenuLoaded(true);
      })
      .catch(() => {
        if (!cachedMenu) setDynamicMenu([]);
        setMenuLoaded(true);
      });
  }, [roleOverride, user?.actualRole, user?.id, user?.role]);

  useEffect(() => {
    if (!user) return;
    setRecentItems(Array.isArray(navigationPrefs?.recentItems) ? navigationPrefs.recentItems : readRecentItems(user));
    setStarredPaths(Array.isArray(navigationPrefs?.starredPaths) ? navigationPrefs.starredPaths : readStarredPaths(user));
    setSidebarWidth(
      Number.isFinite(Number(navigationPrefs?.sidebarWidth))
        ? Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Number(navigationPrefs.sidebarWidth)))
        : readSidebarWidth(user)
    );
  }, [user?.id, user?.email, user?.role]);

  useEffect(() => {
    if (!canRoleOverride) return;
    setViewRole(roleOverride || user?.actualRole || user?.role || "");
  }, [canRoleOverride, roleOverride, user?.actualRole, user?.role]);

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

  const rawSections = useMemo(() => {
    if (menuLoaded && dynamicMenu.length > 0) return dynamicMenu;
    return buildFallbackSections({ homePath, normalizedRole, showAI });
  }, [dynamicMenu, homePath, menuLoaded, normalizedRole, showAI]);

  const menuSections = useMemo(
    () =>
      dedupeSectionsByPath(
        rawSections
        .map((section) => ({
          ...section,
          items: (section.items || []).filter((item) => item?.path && allowMenuItem(item)),
        }))
        .filter((section) => section.items.length > 0)
      ),
    [allowMenuItem, rawSections]
  );

  const filteredSections = useMemo(() => {
    const query = navQuery.trim().toLowerCase();
    if (!query) return menuSections;
    return menuSections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => matchesQuery(item.label, query, translateText)),
      }))
      .filter((section) => section.items.length > 0);
  }, [menuSections, navQuery, translateText]);

  const quickLinks = useMemo(() => {
    const links = dedupeByPath([
      { label: "Home", path: homePath, icon: "home" },
      { label: "Profile", path: "/profile", icon: "account" },
      {
        label: "Notifications",
        path: "/notifications",
        icon: "notifications",
        badge: pharmacyRiskAlertCount > 0 ? String(pharmacyRiskAlertCount) : "",
      },
      ...getQuickActionsForRole(normalizedRole),
    ]);
    return links.slice(0, 6);
  }, [homePath, normalizedRole, pharmacyRiskAlertCount]);

  const allKnownItems = useMemo(
    () =>
      dedupeByPath([
        ...quickLinks,
        ...menuSections.flatMap((section) => section.items),
        ...getQuickActionsForRole(normalizedRole),
      ]),
    [menuSections, normalizedRole, quickLinks]
  );

  const recentVisible = useMemo(() => {
    const allowedPaths = new Set(allKnownItems.map((item) => item.path));
    return recentItems.filter((item) => allowedPaths.has(item.path));
  }, [allKnownItems, recentItems]);

  const starredVisible = useMemo(() => {
    const itemByPath = new Map(allKnownItems.map((item) => [item.path, item]));
    return starredPaths.map((path) => itemByPath.get(path)).filter(Boolean);
  }, [allKnownItems, starredPaths]);

  const filteredSectionsWithoutStarred = useMemo(() => {
    if (!starredPaths.length) return filteredSections;
    const starredSet = new Set(starredPaths);
    return filteredSections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => !starredSet.has(item.path)),
      }))
      .filter((section) => section.items.length > 0);
  }, [filteredSections, starredPaths]);

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

  const runRoleSwitch = () => {
    if (!viewRole) return;
    setRoleOverride(viewRole);
    navigate(redirectByRole({ role: viewRole }));
    onClose?.();
  };

  const resetRoleSwitch = () => {
    const actual = user?.actualRole || user?.role;
    setRoleOverride("");
    setViewRole(actual || "");
    navigate(redirectByRole({ role: actual }));
    onClose?.();
  };

  if (!user) return null;

  return (
    <aside
      className={`sidebar ${open ? "is-open" : "collapsed"}`}
      style={{ "--sidebar-width": `${sidebarWidth}px` }}
      onWheel={(event) => event.stopPropagation()}
    >
      <div className="sidebar-header sticky sidebar-header-premium">
        <div className="sidebar-brand-lockup">
          <div className="brand-mark">
            {settings?.branding?.logo ? (
              <span className="brand-logo" style={{ backgroundImage: `url(${settings.branding.logo})` }} />
            ) : (
              appName
            )}
          </div>
          <div className="brand-sub">{translateText(appTagline || `${normalizedRole} Workspace`)}</div>
        </div>
        <div className="sidebar-role-row">
          <span className="sidebar-role-chip">{translateText(normalizedRole.replaceAll("_", " "))}</span>
          {showRoleChip ? (
            <span className="sidebar-role-chip ghost">{translateText(`Viewing ${user.role}`)}</span>
          ) : null}
        </div>
        {canRoleOverride ? (
          <div className="sidebar-workspace-shell">
            <label className="sidebar-search-label" htmlFor="sidebar-workspace-switcher">
              {translateText("Workspace switcher")}
            </label>
            <select
              id="sidebar-workspace-switcher"
              className="sidebar-workspace-select"
              value={viewRole}
              onChange={(event) => setViewRole(event.target.value)}
            >
              {ROLE_VIEW_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {translateText(role)}
                </option>
              ))}
            </select>
            <label className="sidebar-inline-check">
              <input
                type="checkbox"
                checked={Boolean(strictImpersonation)}
                onChange={(event) => setStrictImpersonation(event.target.checked)}
              />
              <span>{translateText("Strict impersonation")}</span>
            </label>
            <div className="sidebar-workspace-actions">
              <button type="button" className="btn-primary" onClick={runRoleSwitch}>
                {translateText("Switch view")}
              </button>
              <button type="button" className="btn-secondary" onClick={resetRoleSwitch}>
                {translateText("Reset")}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="sidebar-scroll">
        <div className="sidebar-search-shell">
          <label className="sidebar-search-label" htmlFor="sidebar-jump-search">
            {translateText("Global search / command")}
          </label>
          <button type="button" className="sidebar-command-button" onClick={openGlobalSearch}>
            <NavIcon name="search" />
            <span>{translateText("Open command palette")}</span>
          </button>
          <input
            id="sidebar-jump-search"
            className="sidebar-search-input"
            value={navQuery}
            onChange={(event) => setNavQuery(event.target.value)}
            placeholder={translateText("Filter grouped tools in this workspace")}
          />
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

        {filteredSectionsWithoutStarred.map((section) => (
          <SidebarCluster key={section.section} title={section.section} hint={`${section.items.length} tools`}>
            {section.items.map((item) => (
              <SidebarItem
                key={`${section.section}-${item.path}`}
                item={item}
                active={isActivePath(location.pathname, item.path)}
                onSelect={handleSelect}
                badge={item.path === "/notifications" && pharmacyRiskAlertCount > 0 ? String(pharmacyRiskAlertCount) : item.badge}
                isStarred={starredPaths.includes(item.path)}
                onToggleStar={toggleStarred}
              />
            ))}
          </SidebarCluster>
        ))}

        {filteredSectionsWithoutStarred.length === 0 ? (
          <div className="sidebar-empty-note">
            {translateText("No tools match this filter yet. Try a simpler keyword.")}
          </div>
        ) : null}
      </div>

      <div className="sidebar-footer sticky-footer">
        <div className="sidebar-theme-toggle" role="group" aria-label="Theme mode">
          <button
            type="button"
            className={`sidebar-theme-btn ${theme === "light" ? "active" : ""}`.trim()}
            onClick={() => setTheme("light")}
          >
            {translateText("Light")}
          </button>
          <button
            type="button"
            className={`sidebar-theme-btn ${theme === "dark" ? "active" : ""}`.trim()}
            onClick={() => setTheme("dark")}
          >
            {translateText("Dark")}
          </button>
          <button
            type="button"
            className={`sidebar-theme-btn ${theme === "system" ? "active" : ""}`.trim()}
            onClick={() => setTheme("system")}
          >
            {translateText("System")}
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
        <div>{appName} • {translateText("Secure")}</div>
      </div>

      <button type="button" className="sidebar-resize-handle" onMouseDown={startResize} aria-label="Resize sidebar" />
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

function getQuickActions(role) {
  return getQuickActionsForRole(role);
}
