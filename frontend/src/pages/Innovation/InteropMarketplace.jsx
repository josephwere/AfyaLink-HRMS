import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { useAuth } from "../../utils/auth";
import { normalizeRole } from "../../utils/normalizeRole";
import apiFetch from "../../utils/apiFetch";
import { getInteropMarketplaceSnapshot } from "../../services/platformInnovationApi";

function formatWhen(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function readinessTone(value) {
  switch (String(value || "").toUpperCase()) {
    case "CUTOVER_READY":
      return "ok";
    case "ACTIVE":
      return "connected";
    case "CONFIGURED":
      return "watch";
    default:
      return "neutral";
  }
}

export default function InteropMarketplace() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const actorRole = normalizeRole(user?.actualRole || user?.role);
  const canSwitchHospital = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(actorRole);
  const isHospitalOperator = ["HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT"].includes(actorRole);
  const [hospitalId, setHospitalId] = useState(() => searchParams.get("hospitalId") || "");
  const [snapshot, setSnapshot] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!canSwitchHospital) return;
    apiFetch("/api/hospitals/marketplace?limit=200")
      .then((res) => setHospitals(Array.isArray(res?.items) ? res.items : []))
      .catch(() => setHospitals([]));
  }, [canSwitchHospital]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setMsg("");
    getInteropMarketplaceSnapshot({ hospitalId: hospitalId || undefined })
      .then((res) => {
        if (!alive) return;
        setSnapshot(res || null);
      })
      .catch((err) => {
        if (!alive) return;
        setSnapshot(null);
        setMsg(err?.message || "Failed to load interop marketplace.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [hospitalId]);

  const summary = snapshot?.summary || {};
  const connectorTypes = snapshot?.connectorTypes || [];
  const curatedApps = snapshot?.curatedApps || [];
  const mappings = snapshot?.mappings || [];
  const recentConnectors = snapshot?.recentConnectors || [];

  const hubPath = isHospitalOperator ? "/hospital-admin/customization" : "/system-admin/integration-hub";
  const controlPlanePath = isHospitalOperator ? "/hospital-admin/machine-connectivity" : "/system-admin/integration-control-plane";
  const sdkPath =
    actorRole === "HOSPITAL_ADMIN"
      ? "/admin/realtime"
      : isHospitalOperator
      ? "/hospital-admin/customization"
      : "/system-admin/connector-sdk";
  const mappingPath = isHospitalOperator ? "/hospital-admin/customization" : "/system-admin/mapping-studio";

  const summaryCards = useMemo(
    () => [
      { title: "Connectors", value: summary.connectors ?? 0, onClick: () => window.scrollTo({ top: 520, behavior: "smooth" }) },
      { title: "Active Connectors", value: summary.activeConnectors ?? 0, onClick: () => navigate(controlPlanePath) },
      { title: "Realtime Ready", value: summary.realtimeReady ?? 0, onClick: () => navigate(hubPath) },
      { title: "Batch Ready", value: summary.batchReady ?? 0, onClick: () => navigate(hubPath) },
      { title: "HL7 Mappings", value: summary.hl7Mappings ?? 0, onClick: () => window.scrollTo({ top: 1180, behavior: "smooth" }) },
      { title: "SDK / Install Paths", value: curatedApps.length, onClick: () => navigate(sdkPath) },
    ],
    [controlPlanePath, curatedApps.length, hubPath, navigate, sdkPath, summary]
  );

  const heroPulses = useMemo(
    () => [
      {
        label: "Connector estate",
        value: summary.connectors ?? 0,
        tone: Number(summary.connectors || 0) > 0 ? "good" : "neutral",
        detail: "Total connector footprints currently visible in the marketplace.",
      },
      {
        label: "Runtime active",
        value: summary.activeConnectors ?? 0,
        tone: Number(summary.activeConnectors || 0) > 0 ? "good" : "warn",
        detail: "Connectors already live and moving data or events.",
      },
      {
        label: "Realtime posture",
        value: summary.realtimeReady ?? 0,
        tone: Number(summary.realtimeReady || 0) > 0 ? "good" : "neutral",
        detail: "Connector installs ready for realtime workflows.",
      },
      {
        label: "Mapping depth",
        value: summary.hl7Mappings ?? 0,
        tone: Number(summary.hl7Mappings || 0) > 0 ? "good" : "warn",
        detail: "Structured message mappings available for rollout and troubleshooting.",
      },
    ],
    [summary]
  );

  return (
    <div className="dashboard premium-shell interop-marketplace-shell innovation-console-page">
      <section className="premium-card premium-shell-head innovation-console-hero">
        <div className="innovation-console-hero-layout">
          <div className="innovation-console-hero-copy">
            <div className="premium-shell-kicker">Deep interoperability marketplace</div>
            <h1 className="premium-shell-title">Interop Marketplace</h1>
            <p className="premium-shell-subtitle">
              See install-ready connector families, runtime posture, message mappings, and the fastest path to bring hospitals onto FHIR, HL7, imaging, payments, and outreach rails.
            </p>
            <div className="welcome-actions">
              {canSwitchHospital ? (
                <select
                  value={hospitalId}
                  onChange={(e) => {
                    const next = e.target.value;
                    setHospitalId(next);
                    setSearchParams(next ? { hospitalId: next } : {});
                  }}
                >
                  <option value="">All hospitals</option>
                  {hospitals.map((hospital) => (
                    <option key={hospital._id} value={hospital._id}>
                      {hospital.name}
                    </option>
                  ))}
                </select>
              ) : null}
              <button type="button" className="btn-secondary" onClick={() => window.location.reload()} disabled={loading}>
                {loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
          <div className="innovation-console-hero-meta">
            {heroPulses.map((item) => (
              <div key={item.label} className={`innovation-console-pulse ${item.tone}`}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.detail}</small>
              </div>
            ))}
          </div>
        </div>
        <div className="premium-note-grid">
          <div className="premium-note">
            <strong>Scope</strong>
            <span>{snapshot?.scope?.hospitalName || "Loading scope..."}</span>
          </div>
          <div className="premium-note">
            <strong>Best use</strong>
            <span>Use this to plan installs, inspect connector drift, and keep rollout posture visible.</span>
          </div>
          <div className="premium-note">
            <strong>Profiles covered</strong>
            <span>FHIR, HL7, DICOM, payments, outreach, and custom connectors.</span>
          </div>
        </div>
      </section>

      {msg ? (
        <section className="section">
          <div className="card">{msg}</div>
        </section>
      ) : null}

      <section className="section">
        <div className="grid info-grid">
          {summaryCards.map((card) => (
            <StatCard key={card.title} title={card.title} value={card.value} onClick={card.onClick} />
          ))}
        </div>
      </section>

      <section className="section revenue-alert-grid">
        <div className="card premium-card">
          <div className="card-header-actions">
            <div>
              <h3>Curated App Families</h3>
              <p className="muted">The install catalog view that makes connector readiness legible for teams and hospital operators.</p>
            </div>
            <button type="button" className="btn-secondary" onClick={() => navigate(sdkPath)}>Connector SDK</button>
          </div>
          <div className="marketplace-app-grid">
            {curatedApps.map((app) => (
              <div key={app.key} className="marketplace-app-card">
                <div className="card-header-actions">
                  <div>
                    <strong>{app.label}</strong>
                    <p className="muted">{app.category}</p>
                  </div>
                  <span className={`action-pill ${readinessTone(app.readiness)}`}>{app.readiness.replaceAll("_", " ")}</span>
                </div>
                <div className="doctor-actions-row" style={{ marginTop: 10 }}>
                  <span className="action-pill">{app.installedCount} installed</span>
                  <span className="action-pill">{app.activeCount} active</span>
                </div>
                <p className="muted" style={{ marginTop: 10 }}>
                  Profiles: {app.profiles.join(", ")}
                </p>
                <p className="muted">Hospitals: {app.hospitals.length ? app.hospitals.join(", ") : "No active installs yet"}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card premium-card">
          <div className="card-header-actions">
            <div>
              <h3>Connector Mix</h3>
              <p className="muted">A quick signal of which connector families dominate the estate.</p>
            </div>
            <button type="button" className="btn-secondary" onClick={() => navigate(hubPath)}>Integration hub</button>
          </div>
          <div className="signal-chip-grid" style={{ marginTop: 12 }}>
            {connectorTypes.map((item) => (
              <span key={item.type} className="action-pill">
                {item.type} • {item.count}
              </span>
            ))}
            {!connectorTypes.length ? <div className="muted">No connector mix available yet.</div> : null}
          </div>
        </div>
      </section>

      <section className="section revenue-panel-grid">
        <div className="card premium-card">
          <div className="card-header-actions">
            <div>
              <h3>Recent Connector Runtime</h3>
              <p className="muted">The latest connectors in the estate with runtime mode and error context.</p>
            </div>
            <button type="button" className="btn-secondary" onClick={() => navigate(controlPlanePath)}>Control plane</button>
          </div>
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="table premium-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Mode</th>
                  <th>Hospital</th>
                  <th>Last Success</th>
                </tr>
              </thead>
              <tbody>
                {recentConnectors.map((row) => (
                  <tr key={row._id}>
                    <td>
                      <div>{row.name}</div>
                      {row.lastError ? <div className="muted">{row.lastError}</div> : null}
                    </td>
                    <td>{row.type || "custom"}</td>
                    <td>{row.mode}</td>
                    <td>{row.hospitalName}</td>
                    <td>{formatWhen(row.lastSuccessAt)}</td>
                  </tr>
                ))}
                {!recentConnectors.length ? (
                  <tr>
                    <td colSpan={5}>No connector runtime data yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card premium-card">
          <div className="card-header-actions">
            <div>
              <h3>Message Mappings</h3>
              <p className="muted">Recent message-map definitions across source and target systems.</p>
            </div>
            <button type="button" className="btn-secondary" onClick={() => navigate(mappingPath)}>
              {isHospitalOperator ? "Connector setup" : "Mapping studio"}
            </button>
          </div>
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="table premium-table">
              <thead>
                <tr>
                  <th>Message</th>
                  <th>Source</th>
                  <th>Target</th>
                  <th>Status</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((row) => (
                  <tr key={row._id}>
                    <td>{row.messageType || "—"}</td>
                    <td>{row.sourceSystem || "—"}</td>
                    <td>{row.targetSystem || "—"}</td>
                    <td>{row.isActive ? "Active" : "Paused"}</td>
                    <td>{formatWhen(row.updatedAt)}</td>
                  </tr>
                ))}
                {!mappings.length ? (
                  <tr>
                    <td colSpan={5}>No mapping definitions yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
