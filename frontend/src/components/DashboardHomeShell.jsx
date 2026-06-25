import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ActionCard } from "./Cards";
import { useAppLanguage } from "../utils/appLanguage.jsx";
import { useUiPreferences } from "../utils/uiPreferences";
import { prefetchRouteByPath } from "../utils/routePrefetch";
import { canonicalizePath } from "../app/routing/canonicalizePath";

function DashboardActionButton({ action }) {
  const navigate = useNavigate();
  const { translateText } = useAppLanguage();
  const resolvedPath = canonicalizePath(action?.path);

  const handleClick = () => {
    if (typeof action?.onClick === "function") {
      action.onClick(navigate);
      return;
    }
    if (resolvedPath) {
      navigate(resolvedPath);
    }
  };

  return (
    <button
      type="button"
      className={action?.variant === "secondary" ? "btn-secondary" : "btn-primary"}
      onClick={handleClick}
      onMouseEnter={() => prefetchRouteByPath(resolvedPath)}
      onFocus={() => prefetchRouteByPath(resolvedPath)}
      disabled={action?.disabled || (!resolvedPath && typeof action?.onClick !== "function")}
    >
      {translateText(action?.label || "Open")}
    </button>
  );
}

export function DashboardSection({ title, subtitle = "", actions = [], children, className = "" }) {
  const { translateText } = useAppLanguage();

  return (
    <section className={`section dashboard-home-section ${className}`.trim()}>
      {(title || subtitle || actions.length > 0) && (
        <div className="dashboard-home-section-head">
          <div>
            {title ? <h3>{translateText(title)}</h3> : null}
            {subtitle ? <p className="muted">{translateText(subtitle)}</p> : null}
          </div>
          {actions.length > 0 ? (
            <div className="dashboard-home-section-tools">
              {actions.map((action) => (
                <DashboardActionButton key={`${action.label}-${action.path || "inline"}`} action={action} />
              ))}
            </div>
          ) : null}
        </div>
      )}
      {children}
    </section>
  );
}

function ContextRailCard({ card }) {
  const navigate = useNavigate();
  const { translateText } = useAppLanguage();

  const runAction = (action) => {
    if (typeof action?.onClick === "function") {
      action.onClick(navigate);
      return;
    }
    const resolvedPath = canonicalizePath(action?.path);
    if (resolvedPath) {
      navigate(resolvedPath);
    }
  };

  return (
    <section className="premium-card dashboard-context-card">
      <div className="dashboard-context-head">
        <div>
          <h4>{translateText(card?.title || "Context")}</h4>
          {card?.subtitle ? <p className="muted">{translateText(card.subtitle)}</p> : null}
        </div>
        {card?.badge ? <span className="dashboard-context-badge">{translateText(card.badge)}</span> : null}
      </div>

      {Array.isArray(card?.items) && card.items.length > 0 ? (
        <div className="dashboard-context-list">
          {card.items.map((item) => (
            <div className="dashboard-context-item" key={`${item.label}-${item.value}`}>
              <span>{translateText(item.label)}</span>
              <strong className={item.tone ? `tone-${item.tone}` : ""}>
                {typeof item.value === "string" ? translateText(item.value) : item.value}
              </strong>
            </div>
          ))}
        </div>
      ) : null}

      {Array.isArray(card?.actions) && card.actions.length > 0 ? (
        <div className="dashboard-context-actions">
          {card.actions.map((action) => (
            <button
              key={`${action.label}-${action.path || "inline"}`}
              type="button"
              className={action.variant === "secondary" ? "btn-secondary" : "btn-primary"}
              onClick={() => runAction(action)}
            >
              {translateText(action.label)}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function readShelfPrefs(storageKey) {
  if (!storageKey) return { hiddenIds: [], pinnedIds: [], order: [] };
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = JSON.parse(raw || "{}");
    return {
      hiddenIds: Array.isArray(parsed?.hiddenIds) ? parsed.hiddenIds : [],
      pinnedIds: Array.isArray(parsed?.pinnedIds) ? parsed.pinnedIds : [],
      order: Array.isArray(parsed?.order) ? parsed.order : [],
    };
  } catch {
    return { hiddenIds: [], pinnedIds: [], order: [] };
  }
}

function writeShelfPrefs(storageKey, prefs) {
  if (!storageKey) return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(prefs));
  } catch {
    // Ignore localStorage failures for dashboard card preferences.
  }
}

function moveItemInArray(ids, targetId, direction) {
  const current = [...ids];
  const index = current.indexOf(targetId);
  if (index === -1) return current;
  const nextIndex = direction === "left" ? index - 1 : index + 1;
  if (nextIndex < 0 || nextIndex >= current.length) return current;
  const [removed] = current.splice(index, 1);
  current.splice(nextIndex, 0, removed);
  return current;
}

function DashboardCardShelf({ storageKey, title, subtitle, items = [], emptyTitle = "No items yet.", emptyBody = "This shelf will populate as soon as the workspace has content.", variant = "medium" }) {
  const { translateText } = useAppLanguage();
  const { uiPreferences, setUiPreferences } = useUiPreferences();
  const savedPrefs = uiPreferences?.dashboardShelves?.[storageKey];
  const [prefs, setPrefs] = useState(() => savedPrefs || readShelfPrefs(storageKey));
  const hasMountedRef = useRef(false);

  useEffect(() => {
    setPrefs(savedPrefs || readShelfPrefs(storageKey));
  }, [savedPrefs, storageKey]);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    writeShelfPrefs(storageKey, prefs);
    setUiPreferences({
      dashboardShelves: {
        [storageKey]: prefs,
      },
    });
  }, [prefs, setUiPreferences, storageKey]);

  const normalizedItems = useMemo(
    () => (Array.isArray(items) ? items.filter((item) => item?.id) : []),
    [items]
  );

  const arrangedItems = useMemo(() => {
    if (!normalizedItems.length) return [];
    const orderSeed = prefs.order.filter((id) => normalizedItems.some((item) => item.id === id));
    const remaining = normalizedItems.map((item) => item.id).filter((id) => !orderSeed.includes(id));
    const orderedIds = [...orderSeed, ...remaining];
    const ordered = orderedIds
      .map((id) => normalizedItems.find((item) => item.id === id))
      .filter(Boolean)
      .filter((item) => !prefs.hiddenIds.includes(item.id));
    const pinned = ordered.filter((item) => prefs.pinnedIds.includes(item.id));
    const unpinned = ordered.filter((item) => !prefs.pinnedIds.includes(item.id));
    return [...pinned, ...unpinned];
  }, [normalizedItems, prefs.hiddenIds, prefs.order, prefs.pinnedIds]);

  const togglePinned = (id) => {
    setPrefs((prev) => ({
      ...prev,
      pinnedIds: prev.pinnedIds.includes(id)
        ? prev.pinnedIds.filter((entry) => entry !== id)
        : [...prev.pinnedIds, id],
    }));
  };

  const hideCard = (id) => {
    setPrefs((prev) => ({
      ...prev,
      hiddenIds: prev.hiddenIds.includes(id) ? prev.hiddenIds : [...prev.hiddenIds, id],
    }));
  };

  const moveCard = (id, direction) => {
    setPrefs((prev) => {
      const seeded = normalizedItems.map((item) => item.id);
      const baseOrder = prev.order.length ? prev.order.filter((entry) => seeded.includes(entry)) : seeded;
      return {
        ...prev,
        order: moveItemInArray(baseOrder, id, direction),
      };
    });
  };

  const resetShelf = () => setPrefs({ hiddenIds: [], pinnedIds: [], order: [] });

  return (
    <DashboardSection
      title={title}
      subtitle={subtitle}
      actions={
        prefs.hiddenIds.length || prefs.pinnedIds.length || prefs.order.length
          ? [{ label: "Reset shelf", onClick: resetShelf, variant: "secondary" }]
          : []
      }
    >
      {arrangedItems.length > 0 ? (
        <div className="dashboard-shelf-grid">
          {arrangedItems.map((item, index) => (
            <ActionCard
              key={item.id}
              title={item.title}
              description={item.description}
              eyebrow={item.eyebrow}
              badge={item.badge}
              variant={item.variant || variant}
              footerLabel={item.footerLabel || "Open workflow"}
              path={item.path}
              onClick={item.onClick}
              controls={
                <div className="dashboard-card-tools">
                  <button type="button" className="dashboard-card-tool" onClick={() => togglePinned(item.id)}>
                    {prefs.pinnedIds.includes(item.id) ? "★" : "☆"}
                  </button>
                  <button
                    type="button"
                    className="dashboard-card-tool"
                    onClick={() => moveCard(item.id, "left")}
                    disabled={index === 0}
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    className="dashboard-card-tool"
                    onClick={() => moveCard(item.id, "right")}
                    disabled={index === arrangedItems.length - 1}
                  >
                    →
                  </button>
                  <button type="button" className="dashboard-card-tool danger" onClick={() => hideCard(item.id)}>
                    ×
                  </button>
                </div>
              }
            />
          ))}
        </div>
      ) : (
        <div className="dashboard-empty-state">
          <strong>{translateText(emptyTitle)}</strong>
          <p className="muted">{translateText(emptyBody)}</p>
        </div>
      )}
    </DashboardSection>
  );
}

function DashboardDailyBrief({ brief }) {
  const { translateText } = useAppLanguage();
  if (!brief) return null;

  return (
    <section className="premium-card dashboard-daily-brief">
      <div className="dashboard-daily-brief-copy">
        <div className="premium-shell-kicker">{translateText(brief.kicker || "Daily brief")}</div>
        <h3>{translateText(brief.title || "What needs action now")}</h3>
        {brief.body ? <p className="muted">{translateText(brief.body)}</p> : null}
      </div>
      {Array.isArray(brief.items) && brief.items.length > 0 ? (
        <div className="dashboard-daily-brief-list">
          {brief.items.map((item) => (
            <div key={`${item.label}-${item.value}`} className="dashboard-daily-brief-item">
              <span>{translateText(item.label)}</span>
              <strong className={item.tone ? `tone-${item.tone}` : ""}>
                {typeof item.value === "string" ? translateText(item.value) : item.value}
              </strong>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default function DashboardHomeShell({
  className = "",
  shellKey = "workspace",
  kicker = "",
  title,
  subtitle,
  actions = [],
  stats = [],
  brief = null,
  runway = [],
  pinnedTools = [],
  recentItems = [],
  savedViews = [],
  contextCards = [],
  children,
}) {
  const { translateText } = useAppLanguage();
  const navigate = useNavigate();
  const hasRail = Array.isArray(contextCards) && contextCards.length > 0;
  const [railOpen, setRailOpen] = useState(false);
  const hasStats = Array.isArray(stats) && stats.length > 0;
  const arrangedChildren = useMemo(() => {
    const nodes = React.Children.toArray(children);
    if (!nodes.length) return [];

    const output = [];
    let buffer = [];

    const flush = (seed) => {
      if (!buffer.length) return;
      output.push(
        <div key={`dashboard-custom-grid-${seed}`} className="dashboard-home-custom-grid">
          {buffer}
        </div>
      );
      buffer = [];
    };

    nodes.forEach((node, idx) => {
      const isSection = React.isValidElement(node) && node.type === DashboardSection;
      if (isSection) {
        buffer.push(node);
        return;
      }
      flush(`before-${idx}`);
      output.push(node);
    });

    flush("end");
    return output;
  }, [children]);

  return (
    <div className={`dashboard premium-shell dashboard-home-shell ${className}`.trim()}>
      <section className="premium-card dashboard-home-hero">
        <div className="dashboard-home-hero-copy">
          {kicker ? <div className="premium-shell-kicker">{translateText(kicker)}</div> : null}
          <h1 className="premium-shell-title">{translateText(title)}</h1>
          {subtitle ? <p className="premium-shell-subtitle">{translateText(subtitle)}</p> : null}
        </div>

        {((Array.isArray(actions) && actions.length > 0) || hasRail) ? (
          <div className="dashboard-home-actions">
            {Array.isArray(actions)
              ? actions.map((action) => (
                  <DashboardActionButton key={`${action.label}-${action.path || "inline"}`} action={action} />
                ))
              : null}
            {hasRail ? (
              <button
                type="button"
                className={`btn-secondary${railOpen ? " active" : ""}`}
                onClick={() => setRailOpen((v) => !v)}
              >
                {translateText("Context")}
              </button>
            ) : null}
          </div>
        ) : null}
      </section>

      <div className="dashboard-home-layout">
        <div className="dashboard-home-main">
          {hasStats ? (
            <section className="dashboard-home-pinned-summary" aria-label={translateText("Summary")}>
              <div className="dashboard-home-stats dashboard-home-stats-pinned">
                {stats.map((item) => {
                  const resolvedPath = canonicalizePath(item?.path);
                  const isClickable = typeof item?.onClick === "function" || Boolean(resolvedPath);
                  const StatTag = isClickable ? "button" : "div";
                  const handleClick = () => {
                    if (typeof item?.onClick === "function") {
                      item.onClick(navigate);
                      return;
                    }
                    if (resolvedPath) navigate(resolvedPath);
                  };
                  return (
                    <StatTag
                      key={`${item.label}-${item.value}`}
                      type={isClickable ? "button" : undefined}
                      className={`premium-shell-stat dashboard-home-stat${isClickable ? " stat-clickable" : ""}`.trim()}
                      onClick={isClickable ? handleClick : undefined}
                      onMouseEnter={resolvedPath ? () => prefetchRouteByPath(resolvedPath) : undefined}
                      onFocus={resolvedPath ? () => prefetchRouteByPath(resolvedPath) : undefined}
                      aria-label={translateText(item.label)}
                    >
                      <span>{translateText(item.label)}</span>
                      <strong>{typeof item.value === "string" ? translateText(item.value) : item.value}</strong>
                      {item.note ? <small>{translateText(item.note)}</small> : null}
                    </StatTag>
                  );
                })}
              </div>
            </section>
          ) : null}

          <DashboardDailyBrief brief={brief} />
          {runway.length > 0 ? (
            <DashboardCardShelf
              storageKey={`afyalink_dashboard_shelf_${shellKey}_runway`}
              title="Action runway"
              subtitle="Approvals, queues, alerts, and the highest-value next actions for this workspace."
              items={runway}
              variant="medium"
              emptyTitle="No runway items yet."
              emptyBody="This action runway will populate as soon as this workspace has priority tasks."
            />
          ) : null}

          {arrangedChildren.length ? arrangedChildren : null}

          {pinnedTools.length > 0 ? (
            <DashboardCardShelf
              storageKey={`afyalink_dashboard_shelf_${shellKey}_pinned`}
              title="Pinned tools"
              subtitle="Keep your most-used tools close and shape the order you prefer."
              items={pinnedTools}
              variant="compact"
              emptyTitle="No pinned tools yet."
              emptyBody="Pinned tools from this workspace will appear here."
            />
          ) : null}

          {recentItems.length > 0 || savedViews.length > 0 ? (
            <div className="dashboard-home-bottom-grid">
              {recentItems.length > 0 ? (
                <DashboardCardShelf
                  storageKey={`afyalink_dashboard_shelf_${shellKey}_recent`}
                  title="Recent items"
                  subtitle="Return to the last important places without digging through navigation."
                  items={recentItems}
                  variant="compact"
                />
              ) : null}
              {savedViews.length > 0 ? (
                <DashboardCardShelf
                  storageKey={`afyalink_dashboard_shelf_${shellKey}_saved`}
                  title="Saved views"
                  subtitle="Fast entry points into the filtered queues and views you use repeatedly."
                  items={savedViews}
                  variant="compact"
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {hasRail && railOpen ? (
        <div
          className="drawer-backdrop"
          onClick={() => setRailOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div className="drawer-panel" onClick={(event) => event.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <h3>{translateText("Context")}</h3>
                <p className="muted" style={{ margin: "6px 0 0" }}>
                  {translateText("Signals, AI prompts, and alerts tied to the active workflow.")}
                </p>
              </div>
              <button
                type="button"
                className="icon-btn ghost"
                onClick={() => setRailOpen(false)}
                aria-label={translateText("Close context")}
                title={translateText("Close")}
              >
                ×
              </button>
            </div>
            <div style={{ display: "grid", gap: 16 }}>
              {contextCards.map((card) => (
                <ContextRailCard key={card.title} card={card} />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
