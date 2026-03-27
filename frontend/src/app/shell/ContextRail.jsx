import React from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../utils/auth";

/**
 * Context-aware right rail.
 *
 * This is intentionally minimal for the reset step:
 * - shows current route context
 * - reserves slots for AI + alerts + next actions
 */
export default function ContextRail({ open = false, onClose }) {
  const location = useLocation();
  const { user } = useAuth();

  return (
    <aside
      className={`context-rail${open ? " is-open" : ""}`}
      aria-label="Context panel"
      aria-hidden={!open}
    >
      <div className="card context-rail-card">
        <div className="context-rail-card-header">
          <div>
            <div className="context-rail-kicker">Context</div>
            <strong className="context-rail-title">{user?.name || "Workspace"}</strong>
          </div>
          {typeof onClose === "function" ? (
            <button
              type="button"
              className="icon-btn ghost context-rail-close-btn"
              onClick={onClose}
              aria-label="Close context panel"
              title="Close"
            >
              ×
            </button>
          ) : null}
        </div>
        <div className="muted" style={{ marginTop: 6 }}>
          {location.pathname}
        </div>
      </div>

      <div className="card context-rail-card">
        <div className="context-rail-kicker">AI</div>
        <strong className="context-rail-title">Next best action</strong>
        <p className="muted" style={{ marginTop: 6 }}>
          This rail will surface suggestions, summaries, and action prompts tied to the selected patient, claim, or queue item.
        </p>
      </div>

      <div className="card context-rail-card">
        <div className="context-rail-kicker">Alerts</div>
        <p className="muted" style={{ margin: 0 }}>
          No alerts loaded.
        </p>
      </div>
    </aside>
  );
}
