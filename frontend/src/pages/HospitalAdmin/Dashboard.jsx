import React, { useEffect, useState } from "react";
import { StatCard } from "../../components/Cards";
import { useAuth } from "../../utils/auth";
import { useNavigate } from "react-router-dom";
import { getHospitalAdminDashboard } from "../../services/dashboardApi";
import { runStaffingForecast } from "../../services/mlApi";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [trend, setTrend] = useState({
    requiredDoctors: [],
    requiredNurses: [],
    doctorGap: [],
    nurseGap: [],
  });

  const push = (key, value) => {
    setTrend((prev) => ({
      ...prev,
      [key]: [...(prev[key] || []), Number(value || 0)].slice(-12),
    }));
  };

  const gapStatus = (v) => {
    const n = Number(v || 0);
    if (n <= 0) return "good";
    if (n <= 3) return "warn";
    return "risk";
  };

  const loadForecast = async () => {
    try {
      const r = await runStaffingForecast({
        beds: 180,
        occupancyRate: 0.76,
        avgPatientsPerDoctor: 12,
        avgPatientsPerNurse: 5,
        horizonDays: 7,
      });
      setForecast(r || null);
      push("requiredDoctors", r?.forecast?.requiredDoctors || 0);
      push("requiredNurses", r?.forecast?.requiredNurses || 0);
      push("doctorGap", r?.forecast?.doctorGap || 0);
      push("nurseGap", r?.forecast?.nurseGap || 0);
    } catch {
      setForecast(null);
    }
  };

  useEffect(() => {
    getHospitalAdminDashboard().then(setData).catch(() => setData(null));
    loadForecast();
    const timer = setInterval(loadForecast, 45000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Hospital Admin Operations</h2>
          <p className="muted">Branch-level staffing, approvals, bed flow, attendance and alerts.</p>
        </div>
        <div className="welcome-actions">
          <button className="btn-primary" onClick={() => navigate("/hospital-admin/staff")}>Staff Directory</button>
          <button className="btn-secondary" onClick={() => navigate("/hospital-admin/approvals")}>Leave Approvals</button>
          <button className="btn-secondary" onClick={() => navigate("/hospital-admin/register-staff")}>Recruitment Requests</button>
        </div>
      </div>

      <section className="section">
        <h3>Top Metrics</h3>
        <div className="grid info-grid">
          <StatCard title="Staff Count" value={data?.totalStaff ?? "—"} />
          <StatCard title="Bed Occupancy" value={data?.patientsTotal ?? "—"} />
          <StatCard title="Shift Coverage %" value={data?.openShifts ?? "—"} />
          <StatCard title="Department Alerts" value={data?.pendingRequests ?? "—"} />
        </div>
      </section>

      <section className="section">
        <h3>AI Staffing Risk</h3>
        <div className="grid info-grid">
          <StatCard title="Required Doctors" value={forecast?.forecast?.requiredDoctors ?? "—"} trend={trend.requiredDoctors} subtitle="Auto-refresh 45s" />
          <StatCard title="Required Nurses" value={forecast?.forecast?.requiredNurses ?? "—"} trend={trend.requiredNurses} subtitle="Auto-refresh 45s" />
          <StatCard title="Doctor Gap" value={forecast?.forecast?.doctorGap ?? "—"} trend={trend.doctorGap} subtitle="Auto-refresh 45s" status={gapStatus(forecast?.forecast?.doctorGap)} />
          <StatCard title="Nurse Gap" value={forecast?.forecast?.nurseGap ?? "—"} trend={trend.nurseGap} subtitle="Auto-refresh 45s" status={gapStatus(forecast?.forecast?.nurseGap)} />
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <h3>Center Workspace</h3>
          <div className="panel-grid">
            <button className="action-link" onClick={() => navigate("/workforce/requests#shift")}>Shift Calendar</button>
            <button className="action-link" onClick={() => navigate("/reports")}>Attendance Heatmap</button>
            <button className="action-link" onClick={() => navigate("/hospital-admin/staff")}>Staff Directory</button>
            <button className="action-link" onClick={() => navigate("/reports")}>Budget Overview</button>
          </div>
        </div>

        <div className="card doctor-alerts-card">
          <h3>Right Panel</h3>
          <div className="alert-stack">
            <div className="action-pill">Pending Approvals: {data?.pendingRequests ?? "—"}</div>
            <div className="action-pill">Critical Alerts: {data?.appointmentsToday ?? "—"}</div>
            <button className="btn-secondary" onClick={() => navigate("/admin/notifications")}>Announcements</button>
            <button className="btn-secondary" onClick={() => navigate("/security-admin")}>Incident Reports</button>
          </div>
        </div>
      </section>
    </div>
  );
}
