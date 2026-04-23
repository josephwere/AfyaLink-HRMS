import React from "react";

export default function AppShellSkeleton({
  title = "Loading workspace",
  detail = "Preparing your screen and restoring the latest content.",
  status = "Syncing",
}) {
  return (
    <div className="route-skeleton route-skeleton--app" role="status" aria-live="polite" aria-label={title}>
      <div className="route-skeleton-sidebar" aria-hidden="true">
        <div className="skeleton skeleton-avatar" />
        <div className="route-skeleton-nav">
          <div className="skeleton skeleton-line" style={{ width: "70%" }} />
          <div className="skeleton skeleton-line" style={{ width: "88%" }} />
          <div className="skeleton skeleton-line" style={{ width: "64%" }} />
          <div className="skeleton skeleton-line" style={{ width: "82%" }} />
          <div className="skeleton skeleton-line" style={{ width: "56%" }} />
          <div className="skeleton skeleton-line" style={{ width: "76%" }} />
        </div>
      </div>

      <div className="route-skeleton-main">
        <div className="route-skeleton-statusbar">
          <div className="route-skeleton-statuschip">
            <span className="route-skeleton-statusdot" />
            <span>{status}</span>
          </div>
          <div className="route-skeleton-actions" aria-hidden="true">
            <div className="skeleton skeleton-pill" style={{ width: 116 }} />
            <div className="skeleton skeleton-pill" style={{ width: 148 }} />
          </div>
        </div>

        <div className="route-skeleton-headline">
          <div className="route-skeleton-copy">
            <p className="route-skeleton-kicker">{title}</p>
            <p className="route-skeleton-caption">{detail}</p>
          </div>
          <div className="route-skeleton-topbar" aria-hidden="true">
            <div className="skeleton skeleton-line" style={{ width: "38%", height: 14 }} />
            <div className="skeleton skeleton-pill" style={{ width: 176 }} />
          </div>
        </div>

        <div className="route-skeleton-grid" aria-hidden="true">
          <section className="route-skeleton-panel">
            <div className="skeleton skeleton-line" style={{ width: "46%", height: 14 }} />
            <div className="skeleton skeleton-line" style={{ width: "90%" }} />
            <div className="skeleton skeleton-line" style={{ width: "78%" }} />
            <div className="skeleton skeleton-card" />
          </section>

          <section className="route-skeleton-panel">
            <div className="skeleton skeleton-line" style={{ width: "42%", height: 14 }} />
            <div className="route-skeleton-list">
              <div className="skeleton skeleton-line" style={{ width: "100%" }} />
              <div className="skeleton skeleton-line" style={{ width: "92%" }} />
              <div className="skeleton skeleton-line" style={{ width: "96%" }} />
              <div className="skeleton skeleton-line" style={{ width: "84%" }} />
            </div>
            <div className="skeleton skeleton-card skeleton-card-tall" />
          </section>

          <section className="route-skeleton-panel route-skeleton-panel-wide">
            <div className="skeleton skeleton-line" style={{ width: "28%", height: 14 }} />
            <div className="route-skeleton-chart">
              <div className="skeleton skeleton-card skeleton-card-wide" />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
