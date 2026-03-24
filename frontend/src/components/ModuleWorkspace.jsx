import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppLanguage } from "../utils/appLanguage.jsx";

export default function ModuleWorkspace({ title, subtitle, actions = [], kpis = [], panels = [], children }) {
  const navigate = useNavigate();
  const { translateText } = useAppLanguage();
  const [actionMessage, setActionMessage] = useState("");
  const hasChildren = Boolean(children);
  const meta = [
    { label: translateText("Actions"), value: actions.length || "—" },
    { label: translateText("Signals"), value: kpis.length || "—" },
    { label: translateText("Panels"), value: panels.length || "—" },
    { label: translateText("Depth"), value: translateText(hasChildren ? "Expanded" : "Guided") },
  ];

  const runAction = (action) => {
    try {
      if (typeof action?.onClick === "function") {
        action.onClick(navigate);
        setActionMessage("");
        return;
      }
      if (action?.path) {
        navigate(action.path);
        setActionMessage("");
        return;
      }
      setActionMessage(`"${translateText(action?.label || "Action")}" ${translateText("is not configured yet for this module.")}`);
    } catch {
      setActionMessage(`"${translateText(action?.label || "Action")}" ${translateText("failed to run. Please try again.")}`);
    }
  };

  return (
    <div className="dashboard premium-shell doctor-workspace module-workspace">
      <section className="premium-card premium-shell-head module-workspace-hero">
        <div className="premium-shell-kicker">{translateText("Focused workspace")}</div>
        <div className="card-header-actions">
          <div>
            <h1 className="premium-shell-title">{translateText(title)}</h1>
            <p className="premium-shell-subtitle">{translateText(subtitle)}</p>
          </div>
          <div className="premium-shell-meta">
            {meta.map((item) => (
              <div className="premium-shell-stat" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>
        {actions.length > 0 ? (
          <div className="welcome-actions module-workspace-actions">
            {actions.map((a) => (
              <button
                type="button"
                key={a.label}
                className={a.variant === "primary" ? "btn-primary" : "btn-secondary"}
                onClick={() => runAction(a)}
              >
                {translateText(a.label)}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {actionMessage && <div className="premium-inline-note">{actionMessage}</div>}

      {kpis.length > 0 && (
        <section className="section">
          <h3>{translateText("Summary")}</h3>
          <div className="grid info-grid module-kpi-grid">
            {kpis.map((k) => (
              <button
                type="button"
                className={`card premium-card stat${k.path || typeof k.onClick === "function" ? " stat-clickable" : ""}`}
                key={k.title}
                onClick={() => {
                  if (typeof k.onClick === "function") {
                    k.onClick(navigate);
                    return;
                  }
                  if (k.path) navigate(k.path);
                }}
                disabled={!k.path && typeof k.onClick !== "function"}
              >
                <div className="card-title">{translateText(k.title)}</div>
                <div className="card-value">{k.value}</div>
                {k.subtitle && <div className="card-sub">{translateText(k.subtitle)}</div>}
              </button>
            ))}
          </div>
        </section>
      )}

      {panels.length > 0 && (
        <section className="section">
          <h3>{translateText("Workspace")}</h3>
          <div className="panel-grid module-panel-grid">
            {panels.map((p) => (
              <div className="panel doctor-panel premium-card module-panel-card" key={p.title}>
                <h4>{translateText(p.title)}</h4>
                <p className="muted">{translateText(p.body)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {children}
    </div>
  );
}
