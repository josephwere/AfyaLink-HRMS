import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { useAuth } from "../../utils/auth";
import { getDoctorDashboard } from "../../services/dashboardApi";
import apiFetch from "../../utils/apiFetch";
import { runBurnoutScore } from "../../services/mlApi";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [burnout, setBurnout] = useState(null);
  const [burnoutTrend, setBurnoutTrend] = useState([]);

  const burnoutStatus = (score) => {
    const n = Number(score || 0);
    if (n >= 75) return "risk";
    if (n >= 45) return "warn";
    return "good";
  };

  const loadBurnout = async () => {
    try {
      const r = await runBurnoutScore({
        hoursPerWeek: 56,
        nightShifts: 7,
        consecutiveDays: 7,
        overtimeHours: 14,
        leaveBalanceDays: 6,
        incidentsIn30d: 1,
      });
      setBurnout(r || null);
      setBurnoutTrend((prev) => [...prev, Number(r?.score || 0)].slice(-12));
    } catch {
      setBurnout(null);
    }
  };

  useEffect(() => {
    getDoctorDashboard()
      .then((res) => setData(res))
      .catch(() => setData(null));

    apiFetch("/api/appointments?limit=8&cursorMode=1")
      .then((res) => setAppointments(Array.isArray(res?.items) ? res.items : []))
      .catch(() => setAppointments([]));

    apiFetch("/api/notifications?limit=8")
      .then((res) => {
        const items = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
        setAlerts(items.slice(0, 8));
      })
      .catch(() => setAlerts([]));

    loadBurnout();
    const timer = setInterval(loadBurnout, 45000);
    return () => clearInterval(timer);
  }, []);

  const summary = useMemo(
    () => [
      { title: "Today’s Appointments", value: data?.appointmentsToday ?? "—" },
      { title: "Inpatients Assigned", value: data?.activeEncounters ?? "—" },
      { title: "Surgeries Scheduled", value: data?.upcomingAppointments ?? "—" },
      { title: "Pending Lab Results", value: data?.pendingLabResults ?? "—" },
      { title: "License Expiry (Days)", value: data?.licenseExpiryDays ?? "—" },
    ],
    [data]
  );

  return (
    <div className="dashboard doctor-workspace">
      <div className="welcome-panel">
        <div>
          <h2>Doctor Clinical Workspace</h2>
          <p className="muted">Welcome, Dr. {user?.name || "Clinician"}. Zero-click access to today’s patients and critical alerts.</p>
        </div>
        <div className="welcome-actions">
          <button className="btn-primary" onClick={() => navigate("/doctor/patients")}>Today’s Patients</button>
          <button className="btn-secondary" onClick={() => navigate("/doctor/opd")}>Start Consultation</button>
          <button className="btn-secondary" onClick={() => navigate("/doctor/schedule")}>Open Schedule</button>
          <button className="btn-secondary" onClick={() => navigate("/doctor/leave")}>Leave Requests</button>
        </div>
      </div>

      <section className="section">
        <h3>Clinical KPIs</h3>
        <div className="grid info-grid">
          {summary.map((s) => (
            <StatCard key={s.title} title={s.title} value={s.value} />
          ))}
        </div>
      </section>

      <section className="section">
        <h3>AI Wellbeing Signal</h3>
        <div className="grid info-grid">
          <StatCard title="Burnout Risk Score" value={burnout?.score ?? "—"} trend={burnoutTrend} subtitle="Auto-refresh 45s" status={burnoutStatus(burnout?.score)} />
          <StatCard title="Risk Band" value={burnout?.band ?? "—"} />
          <StatCard title="Recommendations" value={Array.isArray(burnout?.recommendations) ? burnout.recommendations.length : "—"} />
        </div>
        <div className="welcome-actions">
          <button className="btn-secondary" onClick={() => navigate("/system-admin/clinical-intelligence")}>
            Open Clinical Intelligence
          </button>
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <h3>Today’s Schedule</h3>
          <div className="table-wrap">
            <table className="doctor-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Type</th>
                  <th>Patient</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((a) => (
                  <tr key={a._id}>
                    <td>{a.scheduledAt ? new Date(a.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-"}</td>
                    <td>{a.type || "OPD"}</td>
                    <td>{a.patient?.name || a.patient?.firstName || "-"}</td>
                    <td>{a.status || "Scheduled"}</td>
                    <td>
                      <div className="doctor-actions-row">
                        <button className="btn-secondary" onClick={() => navigate("/doctor/medical-records")}>Open Record</button>
                        <button className="btn-secondary" onClick={() => navigate("/doctor/opd")}>Start Consultation</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {appointments.length === 0 && (
                  <tr>
                    <td colSpan="5" className="muted">No appointments loaded.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card doctor-alerts-card">
          <h3>Alerts Panel</h3>
          <div className="alert-stack">
            {alerts.map((n) => (
              <button key={n._id} className="verify-banner" onClick={() => navigate("/admin/notifications")}>
                <span>{n.title || "Clinical Alert"}</span>
              </button>
            ))}
            {alerts.length === 0 && <div className="muted">No active alerts.</div>}
          </div>
        </div>
      </section>
    </div>
  );
}
