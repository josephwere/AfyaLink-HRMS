import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useNavigation, useFavorites } from "../../contexts/NavigationContext";
import { useUserCapabilitiesInfo } from "../../utils/useCapabilities";
import { useAuth } from "../../utils/auth";
import {
  getAvailableModulesForCapabilities,
  getNavigationItemsForCapabilities,
} from "../../config/moduleRegistry";
import { navForWorkspace, workspacesForUser } from "../../app/navigation/workspaces";
import { canonicalizePath } from "../../app/routing/canonicalizePath";
import { useAppLanguage } from "../../utils/appLanguage.jsx";
import { useSystemSettings } from "../../utils/systemSettings.jsx";
import AppIcon from "../AppIcon";
import "./Sidebar.css";

const SIDEBAR_ICON_ALIASES = Object.freeze({
  building: "admin",
  building2: "admin",
  bed: "appointments",
  hospital: "admin",
  door: "inventory",
  users: "staff",
  clock: "appointments",
  stethoscope: "doctor",
  calendar: "appointments",
  phone: "notifications",
  share2: "requests",
  pill: "pharmacy",
  package: "inventory",
  barchart3: "analytics",
  microscope: "lab",
  image: "reports",
  dollarsign: "payroll",
  filetext: "reports",
  trendingup: "analytics",
  alerttriangle: "security",
  clipboardlist: "reports",
});

function normalizeSidebarIcon(name, fallback = "settings") {
  const raw = String(name || "").trim();
  if (!raw) return fallback;
  const normalized = raw.replace(/[\s_-]+/g, "").toLowerCase();
  return SIDEBAR_ICON_ALIASES[normalized] || raw.toLowerCase() || fallback;
}

function SidebarIcon({ name, size = 18 }) {
  return (
    <span className="sidebar-line-icon" aria-hidden="true">
      <AppIcon name={normalizeSidebarIcon(name)} size={size} />
    </span>
  );
}

function toSidebarModule(workspace) {
  return {
    id: workspace.id,
    name: workspace.label,
    icon: workspace.icon,
    description: `${workspace.label} workspace`,
    order: 0,
  };
}

function toSidebarItems(workspace) {
  return (navForWorkspace(workspace.id) || [])
    .filter((group) => group?.slot !== "global")
    .flatMap((group) =>
      (group.items || []).map((item) => ({
        id: item.id || `${workspace.id}-${item.path}`,
        title: item.label,
        description: group.group,
        icon: item.icon,
        route: item.path,
        module: workspace.id,
        moduleName: workspace.label,
      }))
    );
}

/**
 * Navigation Item Component
 */
function SidebarNavItem({ item, isActive, onItemClick }) {
  const { toggleFavorite, isFavorite } = useFavorites();
  const navigate = useNavigate();
  const { translateText } = useAppLanguage();
  const isFav = isFavorite(item.id);

  const handleClick = (e) => {
    e.preventDefault();
    const path = canonicalizePath(item.route);
    if (path) {
      navigate(path);
      onItemClick?.(item);
    }
  };

  const handleFavoriteToggle = (e) => {
    e.stopPropagation();
    toggleFavorite(item);
  };

  return (
    <li>
      <button
        className={`sidebar-nav-item${isActive ? " active" : ""}`.trim()}
        onClick={handleClick}
        title={translateText(item.description || item.title)}
      >
        <SidebarIcon name={item.icon || "settings"} />
        <span className="sidebar-item-text">{translateText(item.title)}</span>
      </button>
      <button
        className={`sidebar-favorite-btn${isFav ? " favorited" : ""}`.trim()}
        onClick={handleFavoriteToggle}
        title={isFav ? translateText("Remove from favorites") : translateText("Add to favorites")}
        aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
      >
        {isFav ? "★" : "☆"}
      </button>
    </li>
  );
}

/**
 * Module Section Component
 */
function isSameOrChildPath(currentPath, route) {
  const current = String(currentPath || "").replace(/\/+$/, "") || "/";
  const target = String(canonicalizePath(route) || "").replace(/\/+$/, "") || "/";
  return current === target || current.startsWith(`${target}/`);
}

function SidebarModule({ module, items, currentPath, onItemClick, defaultExpanded = false }) {
  const { toggleExpanded, isExpanded, expandedModules } = useNavigation();
  const { translateText } = useAppLanguage();
  const hasActiveItem = items.some((item) => isSameOrChildPath(currentPath, item.route));
  const expanded = isExpanded(module.id) || hasActiveItem || (expandedModules.length === 0 && defaultExpanded);

  const handleToggleExpand = (e) => {
    e.preventDefault();
    toggleExpanded(module.id);
  };

  return (
    <div className="sidebar-module">
      <button className="sidebar-module-header" onClick={handleToggleExpand}>
        <SidebarIcon name={module.icon || "settings"} />
        <span className="sidebar-module-title">{translateText(module.name)}</span>
        <span className={`sidebar-expand-icon${expanded ? " expanded" : ""}`.trim()}>
          ▼
        </span>
      </button>

      {expanded && items.length > 0 && (
        <ul className="sidebar-module-items">
          {items.map((item) => {
            const isActive = currentPath === canonicalizePath(item.route);
            return (
              <SidebarNavItem
                key={item.id}
                item={item}
                isActive={isActive}
                onItemClick={onItemClick}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Favorites Section Component
 */
function SidebarFavorites({ currentPath, onItemClick }) {
  const { favorites } = useFavorites();
  const { translateText } = useAppLanguage();

  if (favorites.length === 0) {
    return null;
  }

  return (
    <div className="sidebar-section sidebar-favorites">
      <div className="sidebar-section-title">
        <span>⭐ {translateText("Favorites")}</span>
      </div>
      <ul>
        {favorites.map((item) => {
          const isActive = currentPath === canonicalizePath(item.route);
          return (
            <SidebarNavItem
              key={item.id}
              item={item}
              isActive={isActive}
              onItemClick={onItemClick}
            />
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Recent Pages Section Component
 */
function SidebarRecent({ currentPath, onItemClick }) {
  const { recent } = useNavigation();
  const { translateText } = useAppLanguage();

  if (recent.length === 0) {
    return null;
  }

  return (
    <div className="sidebar-section sidebar-recent">
      <div className="sidebar-section-title">
        <span>🕐 {translateText("Recent")}</span>
      </div>
      <ul>
        {recent.slice(0, 5).map((item) => {
          const isActive = currentPath === canonicalizePath(item.route);
          return (
            <SidebarNavItem
              key={item.id}
              item={item}
              isActive={isActive}
              onItemClick={onItemClick}
            />
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Dynamic Sidebar Component
 * Renders navigation based on user's capabilities
 */
export default function Sidebar({
  currentPath = "",
  onItemClick,
  className = "",
  compact = false,
}) {
  const { user, logout } = useAuth();
  const { info: capabilitiesInfo, loading } = useUserCapabilitiesInfo();
  const { settings } = useSystemSettings();
  const { translateText } = useAppLanguage();
  const navigate = useNavigate();
  const brandLogo = settings?.branding?.logo || "/logo.png";
  const visibilityClass = compact ? "collapsed" : "is-open";
  const shellClassName = ["sidebar", compact ? "compact" : "", visibilityClass, className]
    .filter(Boolean)
    .join(" ");

  const workspaceNavigation = useMemo(() => {
    const workspaces = workspacesForUser(user);
    return {
      modules: workspaces.map(toSidebarModule),
      items: workspaces.flatMap(toSidebarItems),
    };
  }, [user]);

  const capabilities = Array.isArray(capabilitiesInfo?.capabilities) ? capabilitiesInfo.capabilities : [];
  const capabilityNavigation = useMemo(() => {
    if (capabilities.length === 0) {
      return { modules: [], items: [] };
    }

    return {
      modules: getAvailableModulesForCapabilities(capabilities),
      items: getNavigationItemsForCapabilities(capabilities),
    };
  }, [capabilities]);

  const modules = workspaceNavigation.modules.length > 0 ? workspaceNavigation.modules : capabilityNavigation.modules;
  const navigationItems = workspaceNavigation.items.length > 0 ? workspaceNavigation.items : capabilityNavigation.items;
  const sidebarRole = capabilitiesInfo?.role || user?.role || "Unknown";

  const handleLogout = async () => {
    await logout();
  };

  const handleDeleteAccount = () => {
    navigate("/app/platform/account/profile?section=privacyData");
  };

  if (loading && modules.length === 0) {
    return (
      <aside className={shellClassName.trim()}>
        <div className="sidebar-header">
          <div className="sidebar-header-title">
            <span className="sidebar-logo">
              <img
                className="sidebar-brand-image"
                src={brandLogo}
                alt={translateText("AfyaLink")}
                onError={(event) => {
                  event.currentTarget.src = "/logo.png";
                }}
              />
            </span>
            <span className="sidebar-app-name">{translateText("AfyaLink")}</span>
          </div>
        </div>
        <div className="sidebar-modules">
          <div className="sidebar-empty">
            <p className="muted">{translateText("Preparing navigation...")}</p>
          </div>
        </div>
      </aside>
    );
  }

  // Group items by module
  const itemsByModule = {};
  navigationItems.forEach((item) => {
    if (!itemsByModule[item.module]) {
      itemsByModule[item.module] = [];
    }
    itemsByModule[item.module].push(item);
  });

  return (
    <aside className={shellClassName.trim()}>
      {/* Header */}
      <div className="sidebar-header">
        <div className="sidebar-header-title">
          <span className="sidebar-logo">
            <img
              className="sidebar-brand-image"
              src={brandLogo}
              alt={translateText("AfyaLink")}
              onError={(event) => {
                event.currentTarget.src = "/logo.png";
              }}
            />
          </span>
          <span className="sidebar-app-name">{translateText("AfyaLink")}</span>
        </div>
      </div>

      <div className="sidebar-scroll-area">
        <div className="sidebar-navigation">
          <SidebarFavorites currentPath={currentPath} onItemClick={onItemClick} />

          <SidebarRecent currentPath={currentPath} onItemClick={onItemClick} />

          <div className="sidebar-modules">
            {modules.length > 0 ? (
              modules.map((module, index) => (
                <SidebarModule
                  key={module.id}
                  module={module}
                  items={itemsByModule[module.id] || []}
                  currentPath={currentPath}
                  onItemClick={onItemClick}
                  defaultExpanded={index < 2}
                />
              ))
            ) : (
              <div className="sidebar-empty">
                <p className="muted">{translateText("Navigation is being prepared for this role.")}</p>
              </div>
            )}
          </div>

          <div className="sidebar-spacer" />

          <div className="sidebar-footer" role="group" aria-label={translateText("Account actions")}>
            <div className="sidebar-footer-label">{translateText("Account")}</div>
            <div className="sidebar-footer-actions">
              <button type="button" className="sidebar-action-btn sidebar-action-logout" onClick={handleLogout}>
                {translateText("Log out")}
              </button>
              <button type="button" className="sidebar-action-btn sidebar-action-danger" onClick={handleDeleteAccount}>
                {translateText("Delete account")}
              </button>
            </div>
            <div className="sidebar-footer-text">
              <small className="muted">{translateText("Role")}: {sidebarRole}</small>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
