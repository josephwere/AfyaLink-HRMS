import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function DoctorModuleLayout({ title, subtitle, kpis = [], panels = [], actions = [] }) {
  const navigate = useNavigate();
  const [actionMessage, setActionMessage] = useState("");

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
      setActionMessage(`"${action?.label || "Action"}" is not configured yet for this page.`);
    } catch {
      setActionMessage(`"${action?.label || "Action"}" failed to run. Please try again.`);
    }
  };

  return (
    <div className="dashboard doctor-workspace">
      <div className="welcome-panel">
        <div>
          <h2>{title}</h2>
          <p className="muted">{subtitle}</p>
        </div>
        <div className="welcome-actions">
          {actions.map((a) => (
            <button
              type="button"
              key={a.label}
              className={a.variant === "primary" ? "btn-primary" : "btn-secondary"}
              onClick={() => runAction(a)}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {actionMessage && <div className="card">{actionMessage}</div>}

      {kpis.length > 0 && (
        <section className="section">
          <h3>Key Metrics</h3>
          <div className="grid info-grid">
            {kpis.map((k) => (
              <button
                type="button"
                className={`card stat${k.path || typeof k.onClick === "function" ? " stat-clickable" : ""}`}
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
                <div className="card-title">{k.title}</div>
                <div className="card-value">{k.value}</div>
                {k.subtitle && <div className="card-sub">{k.subtitle}</div>}
              </button>
            ))}
          </div>
        </section>
      )}

      {panels.length > 0 && (
        <section className="section">
          <h3>Workspace</h3>
          <div className="panel-grid">
            {panels.map((p) => (
              <div className="panel doctor-panel" key={p.title}>
                <h4>{p.title}</h4>
                <p className="muted">{p.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
