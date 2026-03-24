import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const [clientMeta, setClientMeta] = useState(null);
  const comparisonPath = canSwitchHospital ? "/system-admin/county-command-center" : "/hospital-admin/appointments";
  const requestRef = useRef(0);

  useEffect(() => {
    if (!canSwitchHospital) return;
    apiFetch("/api/hospitals/marketplace?limit=200")
      .then((res) => setHospitals(Array.isArray(res?.items) ? res.items : []))
      .catch(() => setHospitals([]));
  }, [canSwitchHospital]);

  const loadSnapshot = useCallback(
    async ({ preserveSnapshot = false } = {}) => {
      const requestId = requestRef.current + 1;
      requestRef.current = requestId;
      setLoading(true);
      setMsg("");
      try {
        const result = await getDigitalHospitalTwinSnapshot({
          hospitalId: hospitalId || undefined,
        });
        if (requestRef.current !== requestId) return;
        setSnapshot(result?.payload || null);
        setClientMeta(result?.clientMeta || null);
      } catch (err) {
        if (requestRef.current !== requestId) return;
        if (!preserveSnapshot) setSnapshot(null);
        setMsg(
          err?.message ||
            "We could not load the digital hospital twin yet. Try again in a moment."
        );
      } finally {
        if (requestRef.current === requestId) setLoading(false);
      }
    },
    [hospitalId]
  );

  useEffect(() => {
    loadSnapshot({ preserveSnapshot: false });
  }, [loadSnapshot]);

  const hasSnapshot = Boolean(snapshot);
  const initialLoading = loading && !hasSnapshot;
  const refreshing = loading && hasSnapshot;

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

  const controlPaths = useMemo(
    () => [
      {
        eyebrow: "Capacity",
        title: "Open ward pressure board",
        body: "Move from the twin into the live ward board when occupancy or staffing pressure needs direct intervention.",
        actionLabel: "Open ward board",
        onClick: () => navigate("/hospital-admin/ward-board"),
      },
      {
        eyebrow: "Devices",
        title: "Inspect machine posture",
        body: "Open the device console to investigate offline, degraded, or erroring machines without leaving the operating picture.",
        actionLabel: "Open device console",
        onClick: () => navigate("/hospital-admin/machine-connectivity"),
      },
      {
        eyebrow: "Emergency",
        title: "Escalate emergency state",
        body: "Jump into the emergency command view when the network needs coordinated action across hospitals.",
        actionLabel: "Open emergency view",
        onClick: () => navigate("/ops/emergency-command"),
      },
      {
        eyebrow: "Transfers",
        title: "Balance transfer pressure",
        body: "Use the transfer command center when capacity stress is really a handover or routing problem.",
        actionLabel: "Open transfer center",
        onClick: () => navigate("/hospital-admin/transfer-command-center"),
      },
    ],
    [navigate]
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
              <button
                type="button"
                className="btn-secondary"
                onClick={() => loadSnapshot({ preserveSnapshot: hasSnapshot })}
                disabled={loading}
              >
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
          <div className="premium-note">
            <strong>Runtime</strong>
            <span>
              {refreshing
                ? "Refreshing live hospital signals while the current twin stays visible."
                : clientMeta?.attempts > 1
                ? `Loaded after ${clientMeta.attempts} guarded attempts to absorb cold-start latency.`
                : clientMeta?.loadedAt
                ? `Live sync completed ${new Date(clientMeta.loadedAt).toLocaleString()}.`
                : "Warm-start protection is ready for the first live pull."}
            </span>
          </div>
        </div>
      </section>

      {initialLoading ? (
        <section className="section">
          <div className="card premium-card innovation-console-state-card">
            <span className="developer-tool-eyebrow">Warm start</span>
            <strong>Preparing the live hospital twin</strong>
            <p className="muted">
              We are warming the backend and waiting for the first operational snapshot so this page
              does not flash a false timeout on cold start.
            </p>
            <div className="innovation-console-skeleton-grid" aria-hidden="true">
              <div className="innovation-console-skeleton" />
              <div className="innovation-console-skeleton" />
              <div className="innovation-console-skeleton" />
              <div className="innovation-console-skeleton" />
            </div>
          </div>
        </section>
      ) : null}

      {msg ? (
        <div className="premium-inline-note innovation-console-inline-state innovation-console-inline-state-warn">
          <span>{msg}</span>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => loadSnapshot({ preserveSnapshot: hasSnapshot })}
          >
            Retry now
          </button>
        </div>
      ) : null}

      {refreshing ? (
        <div className="premium-inline-note innovation-console-inline-state">
          <span>Refreshing live operational signals. The current twin stays visible until the new snapshot arrives.</span>
          <span className="action-pill">Live sync in progress</span>
        </div>
      ) : null}

      {hasSnapshot ? (
        <>
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
                  <div className="developer-empty-state compact">
                    <strong>No ward telemetry yet.</strong>
                    <p className="muted">Ward pressure tiles will light up here as live bed and occupancy data arrives.</p>
                  </div>
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
                    {!Object.keys(machineSummary).length ? (
                      <div className="developer-empty-state compact">
                        <strong>No machine states yet.</strong>
                        <p className="muted">The device rail will populate here as connectivity data reaches the twin.</p>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="card premium-card compact-card">
                  <h4>Staff mix</h4>
                  <div className="signal-chip-grid">
                    {Object.entries(staffSummary).map(([key, value]) => (
                      <span key={key} className="action-pill">{key} • {value}</span>
                    ))}
                    {!Object.keys(staffSummary).length ? (
                      <div className="developer-empty-state compact">
                        <strong>No staff mix data yet.</strong>
                        <p className="muted">Live staffing composition appears here once the twin sees active roster signals.</p>
                      </div>
                    ) : null}
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
                  <div className="developer-empty-state compact">
                    <strong>No active emergency states right now.</strong>
                    <p className="muted">This stays quiet until a site enters emergency posture or command escalation.</p>
                  </div>
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

          <section className="section">
            <div className="card-header-actions">
              <div>
                <h3>Operational Levers</h3>
                <p className="muted">Open the exact control plane that resolves the pressure you are seeing in the twin.</p>
              </div>
            </div>
            <div className="developer-tool-grid innovation-console-tool-grid">
              {controlPaths.map((item) => (
                <div key={item.title} className="developer-tool-card">
                  <span className="developer-tool-eyebrow">{item.eyebrow}</span>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                  <div className="developer-inline-actions compact">
                    <button type="button" className="btn-secondary" onClick={item.onClick}>
                      {item.actionLabel}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
