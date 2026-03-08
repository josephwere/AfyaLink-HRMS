import React, { useEffect, useMemo, useState } from "react";
import {
  getAppointmentOverview,
  getAppointmentHeatmap,
  getConsultationActivity,
} from "../../services/analyticsApi";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function AppointmentAnalytics() {
  const [overview, setOverview] = useState(null);
  const [heatmap, setHeatmap] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      getAppointmentOverview(),
      getAppointmentHeatmap(),
      getConsultationActivity(),
    ])
      .then(([o, h, c]) => {
        setOverview(o || null);
        setHeatmap(Array.isArray(h) ? h : []);
        setConsultations(Array.isArray(c) ? c : []);
      })
      .catch(() => setError("Failed to load appointment analytics"));
  }, []);

  const topHeat = useMemo(() => [...heatmap].sort((a, b) => (b.count || 0) - (a.count || 0)).slice(0, 12), [heatmap]);

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Appointment Analytics</h2>
          <p className="muted">Track assignment pressure, slot demand, no-shows, and consultation activity.</p>
        </div>
      </div>

      {error && <div className="card">{error}</div>}

      <section className="section">
        <h3>Overview</h3>
        <div className="grid info-grid">
          <div className="card stat">
            <div className="card-title">Appointments (30d)</div>
            <div className="card-value">{overview?.totalAppointments30d ?? "—"}</div>
          </div>
          <div className="card stat">
            <div className="card-title">Pending Assignments</div>
            <div className="card-value">{overview?.pendingAssignments ?? "—"}</div>
          </div>
          <div className="card stat">
            <div className="card-title">No-show Rate</div>
            <div className="card-value">{overview?.noShowRate ?? "—"}%</div>
          </div>
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <h3>Top Services</h3>
          <div className="table-wrap">
            <table className="table premium-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Bookings</th>
                </tr>
              </thead>
              <tbody>
                {(overview?.topServices || []).map((item, index) => (
                  <tr key={`${item._id || "service"}-${index}`}>
                    <td>{item._id || "Unknown"}</td>
                    <td>{item.count}</td>
                  </tr>
                ))}
                {!(overview?.topServices || []).length && (
                  <tr>
                    <td colSpan={2} className="muted">No service data yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card doctor-alerts-card">
          <h3>Consultation Modes</h3>
          <div className="alert-stack">
            {(overview?.consultationModes || []).map((item, index) => (
              <div key={`${item._id || "mode"}-${index}`} className="action-pill">
                {(item._id || "Unknown").replaceAll("_", " ")}: {item.count}
              </div>
            ))}
            {!(overview?.consultationModes || []).length && <div className="muted">No mode data yet.</div>}
          </div>
        </div>
      </section>

      <section className="section">
        <h3>Peak Load Windows</h3>
        <div className="card chart-card">
          <div className="simple-chart">
            {topHeat.map((item, index) => (
              <div key={`heat-${index}`} className="bar-row">
                <span className="bar-label">
                  {DAY_NAMES[(item?._id?.dayOfWeek || 1) - 1] || "Day"} {item?._id?.hour}:00
                </span>
                <div className="bar-track">
                  <div
                    className="bar-fill blue"
                    style={{
                      width: `${Math.max(
                        8,
                        ((item.count || 0) / Math.max(1, ...topHeat.map((row) => row.count || 0))) * 100
                      )}%`,
                    }}
                  />
                </div>
                <span className="bar-value">{item.count}</span>
              </div>
            ))}
            {!topHeat.length && <div className="muted">No load heatmap yet.</div>}
          </div>
        </div>
      </section>

      <section className="section">
        <h3>Consultation Activity</h3>
        <div className="card chart-card">
          <div className="simple-chart">
            {consultations.map((item, index) => (
              <div key={`call-${index}`} className="bar-row">
                <span className="bar-label">{item?._id?.callType || "Call"} / {item?._id?.status || "Status"}</span>
                <div className="bar-track">
                  <div
                    className="bar-fill green"
                    style={{
                      width: `${Math.max(
                        8,
                        ((item.count || 0) / Math.max(1, ...consultations.map((row) => row.count || 0))) * 100
                      )}%`,
                    }}
                  />
                </div>
                <span className="bar-value">{item.count}</span>
              </div>
            ))}
            {!consultations.length && <div className="muted">No consultation data yet.</div>}
          </div>
        </div>
      </section>
    </div>
  );
}
