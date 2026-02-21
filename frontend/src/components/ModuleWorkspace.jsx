import React from "react";
import { useNavigate } from "react-router-dom";

export default function ModuleWorkspace({ title, subtitle, actions = [], kpis = [], panels = [], children }) {
  const navigate = useNavigate();

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
              key={a.label}
              className={a.variant === "primary" ? "btn-primary" : "btn-secondary"}
              onClick={() => (a.onClick ? a.onClick(navigate) : a.path ? navigate(a.path) : null)}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {kpis.length > 0 && (
        <section className="section">
          <h3>Summary</h3>
          <div className="grid info-grid">
            {kpis.map((k) => (
              <div className="card stat" key={k.title}>
                <div className="card-title">{k.title}</div>
                <div className="card-value">{k.value}</div>
                {k.subtitle && <div className="card-sub">{k.subtitle}</div>}
              </div>
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

      {children}
    </div>
  );
}
