import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { useAuth } from "../../utils/auth";
import { triggerAction } from "../../services/actionApi";
import { getSuperAdminDashboard } from "../../services/dashboardApi";
import { getDeveloperOverview } from "../../services/developerApi";
import { listTrainingTrackers } from "../../services/trainingTrackerApi";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [ops, setOps] = useState(null);
  const [msg, setMsg] = useState("");
  const [training, setTraining] = useState({
    total: 0,
    notStarted: 0,
    inProgress: 0,
    completed: 0,
    overdueNotStarted: 0,
    overdueInProgress: 0,
    completionRate: 0,
  });

  useEffect(() => {
    getSuperAdminDashboard().then(setData).catch(() => setData(null));
    getDeveloperOverview().then(setOps).catch(() => setOps(null));
    listTrainingTrackers({ limit: 300 })
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
        setTraining({
          total,
          notStarted,
          inProgress,
          completed,
          overdueNotStarted,
          overdueInProgress,
          completionRate,
        });
      })
      .catch(() =>
        setTraining({
          total: 0,
          notStarted: 0,
          inProgress: 0,
          completed: 0,
          overdueNotStarted: 0,
          overdueInProgress: 0,
          completionRate: 0,
        })
      );
  }, []);

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Super Admin Control Center</h2>
          <p className="muted">Global governance for hospitals, workforce, payroll, security and platform health.</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-primary" onClick={() => navigate("/super-admin/hospitals")}>Hospitals</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/admin/create-admin")}>Role Management</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/payments/full")}>Global Payroll</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/super-admin/settings")}>System Settings</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/super-admin/pharmacies")}>Registered Pharmacies</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/admin/training-tracker?status=IN_PROGRESS")}>Training Tracker</button>
        </div>
      </div>
      {msg && <div className="card">{msg}</div>}

      <section className="section">
        <h3>Global Snapshot</h3>
        <div className="grid info-grid">
          <StatCard
            title="Total Hospitals"
            value={data?.totalHospitals ?? "—"}
            onClick={() => navigate("/super-admin/hospitals")}
          />
          <StatCard title="Total Staff" value={data?.totalUsers ?? "—"} />
          <StatCard title="Active Patients" value={data?.totalPatients ?? "—"} />
          <StatCard title="Payroll This Month" value={data?.paymentsThisMonth ?? "—"} />
          <StatCard title="Workforce Pending" value={ops?.queues?.workforce?.totalPending ?? "—"} />
          <StatCard title="Workforce Breached" value={ops?.queues?.workforce?.breached ?? "—"} />
          <StatCard
            title="Training Completion %"
            value={training.completionRate}
            subtitle={`${training.completed}/${training.total} completed`}
            onClick={() => navigate("/admin/training-tracker?status=IN_PROGRESS")}
          />
        </div>
      </section>

      <section className="section">
        <h3>Training Tracker</h3>
        <div className="grid info-grid">
          <StatCard title="Total Trainees" value={training.total} onClick={() => navigate("/admin/training-tracker")} />
          <StatCard title="Not Started" value={training.notStarted} onClick={() => navigate("/admin/training-tracker?status=NOT_STARTED")} />
          <StatCard title="In Progress" value={training.inProgress} onClick={() => navigate("/admin/training-tracker?status=IN_PROGRESS")} />
          <StatCard title="Completed" value={training.completed} onClick={() => navigate("/admin/training-tracker?status=COMPLETED")} />
          <StatCard title="Overdue Not Started" value={training.overdueNotStarted} onClick={() => navigate("/admin/training-tracker?status=NOT_STARTED")} />
          <StatCard title="Overdue In Progress" value={training.overdueInProgress} onClick={() => navigate("/admin/training-tracker?status=IN_PROGRESS")} />
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <h3>Global Admin Workspace</h3>
          <div className="panel-grid">
            <button
              type="button"
              className="action-link"
              onClick={async () => {
                try {
                  await triggerAction("REVENUE_OVERVIEW");
                  setMsg("");
                } catch (e) {
                  setMsg(e?.message || "Unable to load revenue action right now.");
                } finally {
                  navigate("/payments/full");
                }
              }}
            >
              Revenue Graph
            </button>
            <button type="button" className="action-link" onClick={() => navigate("/analytics")}>Workforce Distribution</button>
            <button type="button" className="action-link" onClick={() => navigate("/reports")}>Compliance Alerts</button>
            <button type="button" className="action-link" onClick={() => navigate("/admin/audit-logs")}>Audit Logs</button>
            <button type="button" className="action-link" onClick={() => navigate("/security-admin")}>Security Incidents</button>
            <button type="button" className="action-link" onClick={() => navigate("/system-admin")}>System Status Monitor</button>
            <button type="button" className="action-link" onClick={() => navigate("/super-admin/pharmacies")}>Pharmacy Registry</button>
            <button type="button" className="action-link" onClick={() => navigate("/admin/training-tracker?role=HOSPITAL_ADMIN&status=NOT_STARTED")}>Training Tracker Board</button>
          </div>
        </div>

        <div className="card doctor-alerts-card">
          <h3>Right Insights Panel</h3>
          <div className="alert-stack">
            <div className="action-pill">Active Sessions: {data?.activeHospitals ?? "—"}</div>
            <div className="action-pill">Pending Requests: {data?.pendingRequests ?? "—"}</div>
            <div className="action-pill">Invoices: {data?.invoicesThisMonth ?? "—"}</div>
            <button type="button" className="btn-secondary" onClick={() => navigate("/notifications")}>Open Alerts</button>
          </div>
        </div>
      </section>

      <section className="section">
        <h3>System Administration</h3>
        <div className="action-list">
          <button type="button" className="action-link" onClick={() => navigate("/admin/realtime")}>Integration Hub</button>
          <button type="button" className="action-link" onClick={() => navigate("/admin/crdt-patients")}>Offline Sync</button>
          <button type="button" className="action-link" onClick={() => navigate("/admin/audit-logs")}>Audit Trails</button>
          <button type="button" className="action-link" onClick={() => navigate("/reports")}>Regulatory Reports</button>
        </div>
      </section>
    </div>
  );
}
