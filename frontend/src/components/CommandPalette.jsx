import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { getSearchCatalog } from "../config/searchCatalog";
import { globalSearch } from "../services/searchApi";
import { useAuth } from "../utils/auth";
import { useAppLanguage } from "../utils/appLanguage.jsx";
import { normalizeRole } from "../utils/normalizeRole";
import { redirectByRole } from "../utils/redirectByRole";
import { useUiPreferences } from "../utils/uiPreferences";
import { getQuickActionsForRole, settingsPathForRole } from "../utils/workspaceNavigation";
import { ROLE_VIEW_OPTIONS } from "../utils/roleViewOptions";

const MAX_RECENT = 8;

function dedupeCommands(items = []) {
  const seen = new Set();
  return (items || []).filter((item) => {
    const key = `${item?.kind || "nav"}::${item?.path || item?.id || item?.label}`;
    if (!item?.label || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function recentCommandKey(item) {
  return `${item?.kind || "nav"}::${item?.path || item?.id || item?.label}`;
}

function CommandRow({ item, active, onSelect }) {
  return (
    <button
      type="button"
      className={`command-palette-row ${active ? "active" : ""}`.trim()}
      onClick={() => onSelect(item)}
    >
      <div className="command-palette-row-copy">
        <strong>{item.label}</strong>
        {item.description ? <span>{item.description}</span> : null}
      </div>
      <div className="command-palette-row-meta">
        {item.badge ? <span className="command-palette-badge">{item.badge}</span> : null}
        {item.hint ? <kbd>{item.hint}</kbd> : null}
      </div>
    </button>
  );
}

function PaletteSection({ title, items, activeIndex, startIndex, onSelect }) {
  if (!items.length) return null;
  return (
    <section className="command-palette-section">
      <div className="command-palette-section-head">{title}</div>
      <div className="command-palette-section-list">
        {items.map((item, index) => (
          <CommandRow
            key={recentCommandKey(item)}
            item={item}
            active={activeIndex === startIndex + index}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}

export default function CommandPalette() {
  const { user, canRoleOverride, setRoleOverride, strictImpersonation, setStrictImpersonation } = useAuth();
  const { translateText } = useAppLanguage();
  const { uiPreferences, setUiPreferences } = useUiPreferences();
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [remoteResults, setRemoteResults] = useState([]);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const normalizedRole = normalizeRole(user?.role || "");
  const searchCatalog = useMemo(() => getSearchCatalog(user), [user]);
  const navigationPrefs = uiPreferences?.navigation || {};
  const palettePrefs = uiPreferences?.commandPalette || {};
  const recentCommands = Array.isArray(palettePrefs?.recentCommands) ? palettePrefs.recentCommands : [];
  const starredPaths = Array.isArray(navigationPrefs?.starredPaths) ? navigationPrefs.starredPaths : [];
  const sidebarRecent = Array.isArray(navigationPrefs?.recentItems) ? navigationPrefs.recentItems : [];

  const quickActions = useMemo(() => {
    const base = [
      { label: translateText("Home"), path: redirectByRole(user), badge: translateText("Workspace") },
      { label: translateText("Account"), path: "/app/platform/account/profile", badge: translateText("Profile") },
      { label: translateText("Notifications"), path: "/app/platform/inbox/notifications", badge: translateText("Inbox") },
      { label: translateText("Settings"), path: settingsPathForRole(normalizedRole), badge: translateText("Preferences") },
      { label: translateText("AI Assistant"), path: "/app/innovation/ai/chatbot", badge: translateText("AI") },
      ...getQuickActionsForRole(normalizedRole).map((item) => ({
        ...item,
        badge: translateText("For you"),
      })),
    ];
    return dedupeCommands(base).slice(0, 8);
  }, [normalizedRole, translateText, user]);

  const starredCommands = useMemo(() => {
    const itemByPath = new Map(searchCatalog.map((item) => [item.path, item]));
    return starredPaths
      .map((path) => itemByPath.get(path))
      .filter(Boolean)
      .map((item) => ({
        ...item,
        badge: translateText("Starred"),
      }));
  }, [searchCatalog, starredPaths, translateText]);

  const recentItems = useMemo(() => {
    const paletteItems = recentCommands.map((item) => ({
      ...item,
      badge: translateText("Recent"),
    }));
    const navItems = sidebarRecent.map((item) => ({
      ...item,
      badge: translateText("Recent"),
    }));
    return dedupeCommands([...paletteItems, ...navItems]).slice(0, MAX_RECENT);
  }, [recentCommands, sidebarRecent, translateText]);

  const roleSwitchCommands = useMemo(() => {
    if (!canRoleOverride) return [];
    return ROLE_VIEW_OPTIONS.map((role) => ({
      id: `switch-${role}`,
      label: translateText(`Switch to ${role.replaceAll("_", " ")}`),
      description: strictImpersonation
        ? translateText("Open this workspace with strict impersonation enabled.")
        : translateText("Open this workspace in role view."),
      kind: "roleSwitch",
      role,
      badge: translateText("Workspace"),
    }));
  }, [canRoleOverride, strictImpersonation, translateText]);

  useEffect(() => {
    if (!open) return undefined;
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!user) return undefined;

    const onOpen = () => setOpen(true);
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("afyalink:open-command-palette", onOpen);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("afyalink:open-command-palette", onOpen);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [user]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setRemoteResults([]);
      setRemoteLoading(false);
      setActiveIndex(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !user) return undefined;
    const searchText = query.trim();
    if (searchText.length < 2) {
      setRemoteResults([]);
      setRemoteLoading(false);
      return undefined;
    }

    setRemoteLoading(true);
    const role = normalizeRole(user?.role || "");
    const canViewHospitals = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role);
    const canViewWorkers = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN"].includes(role);

    const timeout = window.setTimeout(() => {
      globalSearch({ q: searchText, limit: 8 })
        .then((data) => {
          const hospitals = (data?.hospitals || []).map((hospital) => ({
            label: translateText(`Hospital: ${hospital.name}${hospital.code ? ` (${hospital.code})` : ""}`),
            description: translateText("Jump into the matching hospital workspace."),
            path: canViewHospitals
              ? `/app/governance/registry/hospitals?q=${encodeURIComponent(hospital.name || hospital.code || "")}`
              : redirectByRole(user),
            badge: translateText("Hospital"),
          }));
          const workers = (data?.workers || []).map((worker) => ({
            label: `${worker.name} • ${translateText(String(worker.role || ""))}`,
            description: translateText("Open the closest matching staff or user record."),
            path: canViewWorkers
              ? `/app/people/staff/index?q=${encodeURIComponent(worker.name || worker.email || "")}`
              : "/app/platform/account/profile",
            badge: translateText("People"),
          }));
          setRemoteResults(dedupeCommands([...hospitals, ...workers]).slice(0, 8));
        })
        .catch(() => setRemoteResults([]))
        .finally(() => setRemoteLoading(false));
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [open, query, translateText, user]);

  const filteredCatalog = useMemo(() => {
    const searchText = query.trim().toLowerCase();
    if (!searchText) return [];
    return searchCatalog
      .filter((item) => {
        const haystack = `${item.label} ${item.path}`.toLowerCase();
        return haystack.includes(searchText);
      })
      .map((item) => ({
        ...item,
        badge: translateText("Navigate"),
      }))
      .slice(0, 12);
  }, [query, searchCatalog, translateText]);

  const filteredRoleSwitch = useMemo(() => {
    const searchText = query.trim().toLowerCase();
    if (!searchText) return [];
    return roleSwitchCommands.filter((item) => item.label.toLowerCase().includes(searchText));
  }, [query, roleSwitchCommands]);

  const resultSections = useMemo(() => {
    if (!query.trim()) {
      return [
        { title: translateText("For You"), items: quickActions },
        { title: translateText("Recent"), items: recentItems },
        { title: translateText("Starred"), items: starredCommands },
        { title: translateText("Workspace Views"), items: roleSwitchCommands.slice(0, 6) },
      ].filter((section) => section.items.length > 0);
    }

    return [
      { title: translateText("Best Match"), items: dedupeCommands([...filteredCatalog, ...remoteResults]).slice(0, 12) },
      { title: translateText("Remote Search"), items: remoteResults },
      { title: translateText("Workspace Views"), items: filteredRoleSwitch },
    ].filter((section) => section.items.length > 0);
  }, [filteredCatalog, filteredRoleSwitch, quickActions, query, recentItems, remoteResults, roleSwitchCommands, starredCommands, translateText]);

  const flattenedResults = useMemo(() => resultSections.flatMap((section) => section.items), [resultSections]);

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(flattenedResults.length - 1, 0)));
  }, [flattenedResults.length]);

  const closePalette = useCallback(() => setOpen(false), []);

  const rememberCommand = useCallback(
    (item) => {
      const payload = {
        label: item.label,
        description: item.description || "",
        path: item.path || "",
        kind: item.kind || "nav",
        role: item.role || "",
      };
      const next = dedupeCommands([payload, ...recentCommands]).slice(0, MAX_RECENT);
      setUiPreferences({
        commandPalette: {
          ...(uiPreferences?.commandPalette || {}),
          recentCommands: next,
        },
      });
    },
    [recentCommands, setUiPreferences, uiPreferences?.commandPalette]
  );

  const runCommand = useCallback(
    (item) => {
      if (!item) return;
      rememberCommand(item);
      if (item.kind === "roleSwitch" && item.role) {
        setStrictImpersonation(Boolean(strictImpersonation));
        setRoleOverride(item.role);
        navigate(redirectByRole({ role: item.role }));
        closePalette();
        return;
      }
      if (item.path) {
        const nextRecent = dedupeCommands([item, ...(Array.isArray(navigationPrefs.recentItems) ? navigationPrefs.recentItems : [])]).slice(0, MAX_RECENT);
        setUiPreferences({
          navigation: {
            ...(uiPreferences?.navigation || {}),
            recentItems: nextRecent,
          },
        });
        navigate(item.path);
      }
      closePalette();
    },
    [closePalette, navigate, navigationPrefs.recentItems, rememberCommand, setRoleOverride, setStrictImpersonation, setUiPreferences, strictImpersonation, uiPreferences?.navigation]
  );

  const handleKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (flattenedResults.length ? (current + 1) % flattenedResults.length : 0));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (flattenedResults.length ? (current - 1 + flattenedResults.length) % flattenedResults.length : 0));
      return;
    }
    if (event.key === "Enter" && flattenedResults[activeIndex]) {
      event.preventDefault();
      runCommand(flattenedResults[activeIndex]);
    }
  };

  if (!user || !open || typeof document === "undefined") return null;

  let sectionOffset = 0;

  return createPortal(
    <div className="command-palette-backdrop" role="dialog" aria-modal="true" onClick={closePalette}>
      <div className="command-palette-modal" onClick={(event) => event.stopPropagation()}>
        <div className="command-palette-head">
          <div>
            <div className="premium-shell-kicker">{translateText("Command palette")}</div>
            <h3>{translateText("Jump anywhere, faster")}</h3>
            <p className="muted">
              {translateText("Search across dashboards, workflows, hospitals, people, and workspace views without leaving the page.")}
            </p>
          </div>
          <button type="button" className="command-palette-close" onClick={closePalette} aria-label={translateText("Close command palette")}>
            ×
          </button>
        </div>

        <div className="command-palette-search">
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={translateText("Search actions, dashboards, patients, hospitals, claims, settings...")}
          />
          <div className="command-palette-hints">
            <kbd>{navigator?.platform?.toLowerCase().includes("mac") ? "⌘K" : "Ctrl K"}</kbd>
            <span>{translateText("Open anytime")}</span>
          </div>
        </div>

        <div className="command-palette-body">
          {remoteLoading ? (
            <div className="command-palette-loading">{translateText("Searching the platform...")}</div>
          ) : null}

          {resultSections.length > 0 ? (
            resultSections.map((section) => {
              const startIndex = sectionOffset;
              sectionOffset += section.items.length;
              return (
                <PaletteSection
                  key={section.title}
                  title={section.title}
                  items={section.items}
                  activeIndex={activeIndex}
                  startIndex={startIndex}
                  onSelect={runCommand}
                />
              );
            })
          ) : (
            <div className="command-palette-empty">
              <strong>{translateText("No results yet")}</strong>
              <p className="muted">
                {translateText("Try a dashboard name, patient workflow, staff search, or a workspace keyword like compliance or twin.")}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
