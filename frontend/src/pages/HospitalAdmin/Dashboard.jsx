import React, { useEffect, useState } from "react";
import { StatCard } from "../../components/Cards";
import { useAuth } from "../../utils/auth";
import { useNavigate } from "react-router-dom";
import { getHospitalAdminDashboard } from "../../services/dashboardApi";
import { runStaffingForecast } from "../../services/mlApi";
import apiFetch from "../../utils/apiFetch";
import { listTrainingTrackers } from "../../services/trainingTrackerApi";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [machineStats, setMachineStats] = useState({
    total: 0,
    online: 0,
    offline: 0,
    error: 0,
    maintenance: 0,
  });
  const [trainingStats, setTrainingStats] = useState({
    total: 0,
    notStarted: 0,
    inProgress: 0,
    completed: 0,
    overdueNotStarted: 0,
    overdueInProgress: 0,
    completionRate: 0,
  });
  const [trend, setTrend] = useState({
    requiredDoctors: [],
    requiredNurses: [],
    doctorGap: [],
    nurseGap: [],
    trainingCompletion: [],
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
  const badgeFromStatus = (s) => (s === "risk" ? "ALERT" : s === "warn" ? "WATCH" : "OK");

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
    listTrainingTrackers({ hospital: user?.hospital || undefined, limit: 200 })
      .then((res) => {
        const rows = Array.isArray(res?.items) ? res.items : [];
        const now = Date.now();
        const notStarted = rows.filter((r) => r.status === "NOT_STARTED").length;
        const inProgress = rows.filter((r) => r.status === "IN_PROGRESS").length;
        const completed = rows.filter((r) => r.status === "COMPLETED").length;
        const overdueNotStarted = rows.filter(
          (r) =>
            r.status === "NOT_STARTED" &&
            r.createdAt &&
            now - new Date(r.createdAt).getTime() >= 3 * 24 * 60 * 60 * 1000
        ).length;
        const overdueInProgress = rows.filter(
          (r) =>
            r.status === "IN_PROGRESS" &&
            r.updatedAt &&
            now - new Date(r.updatedAt).getTime() >= 7 * 24 * 60 * 60 * 1000
        ).length;
        const total = rows.length;
        const completionRate = total ? Math.round((completed / total) * 100) : 0;
        setTrainingStats({
          total,
          notStarted,
          inProgress,
          completed,
          overdueNotStarted,
          overdueInProgress,
          completionRate,
        });
        push("trainingCompletion", completionRate);
      })
      .catch(() =>
        setTrainingStats({
          total: 0,
          notStarted: 0,
          inProgress: 0,
          completed: 0,
          overdueNotStarted: 0,
          overdueInProgress: 0,
          completionRate: 0,
        })
      );
    apiFetch("/api/machine-connectivity/devices")
      .then((r) => {
        const rows = Array.isArray(r?.items) ? r.items : [];
        setMachineStats({
          total: rows.length,
          online: rows.filter((d) => d.status === "ONLINE").length,
          offline: rows.filter((d) => d.status === "OFFLINE").length,
          error: rows.filter((d) => d.status === "ERROR").length,
          maintenance: rows.filter((d) => d.status === "MAINTENANCE").length,
        });
      })
      .catch(() => {
        setMachineStats({ total: 0, online: 0, offline: 0, error: 0, maintenance: 0 });
      });
    const timer = setInterval(loadForecast, 45000);
    return () => clearInterval(timer);
  }, [user?.hospital]);

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Hospital Admin Operations</h2>
          <p className="muted">Branch-level staffing, approvals, bed flow, attendance and alerts.</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-primary" onClick={() => navigate("/hospital-admin/staff")}>Staff Directory</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/approvals")}>Leave Approvals</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/register-staff")}>Recruitment Requests</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/recruitment-ads")}>Recruitment Ads</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/commerce-config")}>Insurance & Payments</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/financials")}>Financials</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/machine-connectivity")}>Machine Connectivity</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/customization")}>Branding & Customization</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/admin/training-tracker?status=IN_PROGRESS")}>Training Tracker</button>
        </div>
      </div>

      <section className="section">
        <h3>Top Metrics</h3>
        <div className="grid info-grid">
          <StatCard title="Staff Count" value={data?.totalStaff ?? "—"} />
          <StatCard title="Bed Occupancy" value={data?.patientsTotal ?? "—"} />
          <StatCard title="Shift Coverage %" value={data?.openShifts ?? "—"} />
          <StatCard title="Department Alerts" value={data?.pendingRequests ?? "—"} />
          <StatCard
            title="Training Completion %"
            value={trainingStats.completionRate}
            trend={trend.trainingCompletion}
            subtitle={`${trainingStats.completed}/${trainingStats.total} completed`}
            onClick={() => navigate("/admin/training-tracker?status=IN_PROGRESS")}
          />
        </div>
      </section>

      <section className="section">
        <h3>Training Tracker</h3>
        <div className="grid info-grid">
          <StatCard title="Total Trainees" value={trainingStats.total} onClick={() => navigate("/admin/training-tracker")} />
          <StatCard title="Not Started" value={trainingStats.notStarted} onClick={() => navigate("/admin/training-tracker?status=NOT_STARTED")} />
          <StatCard title="In Progress" value={trainingStats.inProgress} onClick={() => navigate("/admin/training-tracker?status=IN_PROGRESS")} />
          <StatCard title="Completed" value={trainingStats.completed} onClick={() => navigate("/admin/training-tracker?status=COMPLETED")} />
          <StatCard title="Overdue Not Started" value={trainingStats.overdueNotStarted} onClick={() => navigate("/admin/training-tracker?status=NOT_STARTED")} />
          <StatCard title="Overdue In Progress" value={trainingStats.overdueInProgress} onClick={() => navigate("/admin/training-tracker?status=IN_PROGRESS")} />
        </div>
      </section>

      <section className="section">
        <h3>AI Staffing Risk</h3>
        <div className="grid info-grid">
          <StatCard title="Required Doctors" value={forecast?.forecast?.requiredDoctors ?? "—"} trend={trend.requiredDoctors} subtitle="Auto-refresh 45s" />
          <StatCard title="Required Nurses" value={forecast?.forecast?.requiredNurses ?? "—"} trend={trend.requiredNurses} subtitle="Auto-refresh 45s" />
          <StatCard
            title="Doctor Gap"
            value={forecast?.forecast?.doctorGap ?? "—"}
            trend={trend.doctorGap}
            subtitle="Auto-refresh 45s"
            status={gapStatus(forecast?.forecast?.doctorGap)}
            badge={badgeFromStatus(gapStatus(forecast?.forecast?.doctorGap))}
            why={`Gap ${forecast?.forecast?.doctorGap ?? 0}; >3 requires urgent staffing intervention.`}
            onBadgeClick={() => navigate("/hospital-admin/register-staff?role=doctor")}
          />
          <StatCard
            title="Nurse Gap"
            value={forecast?.forecast?.nurseGap ?? "—"}
            trend={trend.nurseGap}
            subtitle="Auto-refresh 45s"
            status={gapStatus(forecast?.forecast?.nurseGap)}
            badge={badgeFromStatus(gapStatus(forecast?.forecast?.nurseGap))}
            why={`Gap ${forecast?.forecast?.nurseGap ?? 0}; >3 requires urgent staffing intervention.`}
            onBadgeClick={() => navigate("/hospital-admin/register-staff?role=nurse")}
          />
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <h3>Center Workspace</h3>
          <div className="panel-grid">
            <button type="button" className="action-link" onClick={() => navigate("/workforce/requests#shift")}>Shift Calendar</button>
            <button type="button" className="action-link" onClick={() => navigate("/reports")}>Attendance Heatmap</button>
            <button type="button" className="action-link" onClick={() => navigate("/hospital-admin/staff")}>Staff Directory</button>
            <button type="button" className="action-link" onClick={() => navigate("/hospital-admin/financials")}>Budget & Financials</button>
            <button type="button" className="action-link" onClick={() => navigate("/admin/training-tracker?role=NURSE&status=IN_PROGRESS")}>Training Tracker Board</button>
          </div>
        </div>

        <div className="card doctor-alerts-card">
          <h3>Right Panel</h3>
          <div className="alert-stack">
            <div className="action-pill">Pending Approvals: {data?.pendingRequests ?? "—"}</div>
            <div className="action-pill">Critical Alerts: {data?.appointmentsToday ?? "—"}</div>
            <button type="button" className="btn-secondary" onClick={() => navigate("/notifications")}>Announcements</button>
            <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/approvals")}>Incident Reports</button>
          </div>
        </div>
      </section>

      <section className="section">
        <h3>Machine Connectivity</h3>
        <div className="grid info-grid">
          <StatCard title="Connected Devices" value={machineStats.total} />
          <StatCard title="Online" value={machineStats.online} />
          <StatCard title="Offline" value={machineStats.offline} />
          <StatCard title="Error" value={machineStats.error} />
          <StatCard title="Maintenance" value={machineStats.maintenance} />
        </div>
        <div className="action-list" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="action-link"
            onClick={() => navigate("/hospital-admin/machine-connectivity")}
          >
            Open Machine Connectivity Console
          </button>
          <button
            type="button"
            className="action-link"
            onClick={() => navigate("/hospital-admin/machine-alerts")}
          >
            View Machine Alerts
          </button>
        </div>
      </section>
    </div>
  );
}
