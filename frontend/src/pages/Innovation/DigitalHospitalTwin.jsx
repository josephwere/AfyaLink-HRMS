import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { useAuth } from "../../utils/auth";
import { normalizeRole } from "../../utils/normalizeRole";
import apiFetch from "../../utils/apiFetch";
import { getDigitalHospitalTwinSnapshot } from "../../services/platformInnovationApi";

function formatPct(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

export default function DigitalHospitalTwin() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const actorRole = normalizeRole(user?.actualRole || user?.role);
  const canSwitchHospital = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(actorRole);
  const [hospitalId, setHospitalId] = useState(() => searchParams.get("hospitalId") || "");
  const [snapshot, setSnapshot] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const comparisonPath = canSwitchHospital ? "/system-admin/county-command-center" : "/hospital-admin/appointments";

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
    getDigitalHospitalTwinSnapshot({ hospitalId: hospitalId || undefined })
      .then((res) => {
        if (!alive) return;
        setSnapshot(res || null);
      })
      .catch((err) => {
        if (!alive) return;
        setSnapshot(null);
        setMsg(err?.message || "Failed to load digital hospital twin.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [hospitalId]);

  const summary = snapshot?.summary || {};
  const wardState = snapshot?.wardState || [];
  const hospitalComparison = snapshot?.hospitalComparison || [];
  const emergencyWatch = snapshot?.emergencyWatch || [];
  const machineSummary = snapshot?.machineSummary || {};
  const staffSummary = snapshot?.staffSummary || {};

  const summaryCards = useMemo(
    () => [
      { title: "Network Occupancy", value: formatPct(summary.occupancyRate), onClick: () => window.scrollTo({ top: 520, behavior: "smooth" }) },
      { title: "Online Devices", value: summary.onlineDevices ?? 0, onClick: () => navigate("/hospital-admin/machine-connectivity") },
      { title: "Device Errors", value: summary.deviceErrors ?? 0, onClick: () => navigate("/hospital-admin/machine-alerts") },
      { title: "Active Emergencies", value: summary.activeEmergencyCount ?? 0, onClick: () => window.scrollTo({ top: 920, behavior: "smooth" }) },
      { title: "Consult Slots Live", value: summary.activeConsultSlots ?? 0, onClick: () => navigate("/hospital-admin/consultation-monitor") },
      { title: "Transfer Pressure", value: summary.transferPressure ?? 0, onClick: () => navigate("/hospital-admin/transfer-command-center") },
    ],
    [navigate, summary]
  );

  const heroPulses = useMemo(
    () => [
      {
        label: "Occupancy load",
        value: formatPct(summary.occupancyRate),
        tone: Number(summary.occupancyRate || 0) > 0.88 ? "risk" : Number(summary.occupancyRate || 0) > 0.72 ? "warn" : "good",
        detail: "Bed pressure across the current twin scope.",
      },
      {
        label: "Device availability",
        value: summary.onlineDevices ?? 0,
        tone: Number(summary.deviceErrors || 0) > 0 ? "warn" : "good",
        detail: "Connected devices available for active operations.",
      },
      {
        label: "Emergency watch",
        value: summary.activeEmergencyCount ?? 0,
        tone: Number(summary.activeEmergencyCount || 0) > 0 ? "risk" : "good",
        detail: "Sites currently in emergency posture and needing command attention.",
      },
      {
        label: "Transfer pressure",
        value: summary.transferPressure ?? 0,
        tone: Number(summary.transferPressure || 0) > 6 ? "risk" : Number(summary.transferPressure || 0) > 0 ? "warn" : "neutral",
        detail: "Operational handoffs that could stress beds, consults, or transport lanes.",
      },
    ],
    [summary]
  );

  return (
    <div className="dashboard premium-shell digital-hospital-twin-shell innovation-console-page">
      <section className="premium-card premium-shell-head innovation-console-hero">
        <div className="innovation-console-hero-layout">
          <div className="innovation-console-hero-copy">
            <div className="premium-shell-kicker">Operational digital twin</div>
            <h1 className="premium-shell-title">Digital Hospital Twin</h1>
            <p className="premium-shell-subtitle">
              Track bed stress, device health, emergency posture, consult capacity, and transfer pressure from one operational mirror of the hospital network.
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
            <strong>Decision use</strong>
            <span>Best for shift planning, capacity calls, escalation readiness, and device triage.</span>
          </div>
          <div className="premium-note">
            <strong>Model inputs</strong>
            <span>Beds, machines, doctor availability, appointments, transfers, and emergency state.</span>
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
              <h3>Ward Pressure</h3>
              <p className="muted">Wards with the tightest occupancy should get the earliest staffing and transfer attention.</p>
            </div>
            <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/ward-board")}>Open ward board</button>
          </div>
          <div className="twin-ward-grid">
            {wardState.length ? (
              wardState.map((ward) => (
                <div key={`${ward.hospitalId}-${ward.ward}`} className="twin-ward-card">
                  <div className="card-header-actions">
                    <strong>{ward.ward}</strong>
                    <span className="action-pill">{formatPct(ward.occupancyRate)}</span>
                  </div>
                  <p className="muted">{ward.hospitalName}</p>
                  <div className="doctor-actions-row" style={{ marginTop: 10 }}>
                    <span className="action-pill">{ward.occupiedBeds}/{ward.totalBeds} beds occupied</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="muted" style={{ marginTop: 12 }}>No ward telemetry yet.</div>
            )}
          </div>
        </div>

        <div className="card premium-card">
          <div className="card-header-actions">
            <div>
              <h3>System Pressure Summary</h3>
              <p className="muted">Quick signal rails for devices, staff mix, and consult availability.</p>
            </div>
            <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/machine-connectivity")}>Device console</button>
          </div>
          <div className="panel-grid" style={{ marginTop: 12 }}>
            <div className="card premium-card compact-card">
              <h4>Device states</h4>
              <div className="signal-chip-grid">
                {Object.entries(machineSummary).map(([key, value]) => (
                  <span key={key} className="action-pill">{key} • {value}</span>
                ))}
                {!Object.keys(machineSummary).length ? <div className="muted">No machine states yet.</div> : null}
              </div>
            </div>
            <div className="card premium-card compact-card">
              <h4>Staff mix</h4>
              <div className="signal-chip-grid">
                {Object.entries(staffSummary).map(([key, value]) => (
                  <span key={key} className="action-pill">{key} • {value}</span>
                ))}
                {!Object.keys(staffSummary).length ? <div className="muted">No staff mix data yet.</div> : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section revenue-panel-grid">
        <div className="card premium-card">
          <div className="card-header-actions">
            <div>
              <h3>Emergency Watch</h3>
              <p className="muted">These hospitals have an active emergency state and should stay on the top of the operating picture.</p>
            </div>
            <button type="button" className="btn-secondary" onClick={() => navigate("/ops/emergency-command")}>Emergency view</button>
          </div>
          <div className="compliance-hold-list">
            {emergencyWatch.length ? (
              emergencyWatch.map((row) => (
                <div key={`${row.hospitalId}-${row.activatedAt}`} className="compliance-hold-card compact">
                  <div className="card-header-actions">
                    <strong>{row.hospitalName}</strong>
                    <span className="action-pill warn">Emergency</span>
                  </div>
                  <p className="muted">{row.reason}</p>
                  <div className="doctor-actions-row" style={{ marginTop: 10 }}>
                    <span className="action-pill">Activated {row.activatedAt ? new Date(row.activatedAt).toLocaleString() : "recently"}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="muted" style={{ marginTop: 12 }}>No active emergency states right now.</div>
            )}
          </div>
        </div>

        <div className="card premium-card">
          <div className="card-header-actions">
            <div>
              <h3>Hospital Comparison</h3>
              <p className="muted">Compare occupancy, devices, appointments, and transfer load across hospitals.</p>
            </div>
            <button type="button" className="btn-secondary" onClick={() => navigate(comparisonPath)}>
              {canSwitchHospital ? "County command" : "Operations queue"}
            </button>
          </div>
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="table premium-table">
              <thead>
                <tr>
                  <th>Hospital</th>
                  <th>Occupancy</th>
                  <th>Online Devices</th>
                  <th>Errors</th>
                  <th>Appointments (24h)</th>
                  <th>Transfers</th>
                </tr>
              </thead>
              <tbody>
                {hospitalComparison.map((row) => (
                  <tr key={row.hospitalId || row.hospitalName}>
                    <td>{row.hospitalName}</td>
                    <td>{formatPct(row.bedOccupancyRate)}</td>
                    <td>{row.onlineDevices}</td>
                    <td>{row.deviceErrors}</td>
                    <td>{row.appointments24h}</td>
                    <td>{row.transferPressure}</td>
                  </tr>
                ))}
                {!hospitalComparison.length ? (
                  <tr>
                    <td colSpan={6}>No hospital comparison data yet.</td>
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
