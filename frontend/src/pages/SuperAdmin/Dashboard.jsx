import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { useAuth } from "../../utils/auth";
import { triggerAction } from "../../services/actionApi";
import { getSuperAdminDashboard } from "../../services/dashboardApi";
import { getDeveloperOverview } from "../../services/developerApi";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [ops, setOps] = useState(null);

  useEffect(() => {
    getSuperAdminDashboard().then(setData).catch(() => setData(null));
    getDeveloperOverview().then(setOps).catch(() => setOps(null));
  }, []);

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Super Admin Control Center</h2>
          <p className="muted">Global governance for hospitals, workforce, payroll, security and platform health.</p>
        </div>
        <div className="welcome-actions">
          <button className="btn-primary" onClick={() => navigate("/super-admin/hospitals")}>Hospitals</button>
          <button className="btn-secondary" onClick={() => navigate("/admin/create-admin")}>Role Management</button>
          <button className="btn-secondary" onClick={() => navigate("/payments/full")}>Global Payroll</button>
          <button className="btn-secondary" onClick={() => navigate("/super-admin/settings")}>System Settings</button>
        </div>
      </div>

      <section className="section">
        <h3>Global Snapshot</h3>
        <div className="grid info-grid">
          <StatCard title="Total Hospitals" value={data?.totalHospitals ?? "—"} />
          <StatCard title="Total Staff" value={data?.totalUsers ?? "—"} />
          <StatCard title="Active Patients" value={data?.totalPatients ?? "—"} />
          <StatCard title="Payroll This Month" value={data?.paymentsThisMonth ?? "—"} />
          <StatCard title="Workforce Pending" value={ops?.queues?.workforce?.totalPending ?? "—"} />
          <StatCard title="Workforce Breached" value={ops?.queues?.workforce?.breached ?? "—"} />
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <h3>Global Admin Workspace</h3>
          <div className="panel-grid">
            <button className="action-link" onClick={async () => { await triggerAction("REVENUE_OVERVIEW"); navigate("/payments/full"); }}>Revenue Graph</button>
            <button className="action-link" onClick={() => navigate("/analytics")}>Workforce Distribution</button>
            <button className="action-link" onClick={() => navigate("/reports")}>Compliance Alerts</button>
            <button className="action-link" onClick={() => navigate("/admin/audit-logs")}>Audit Logs</button>
            <button className="action-link" onClick={() => navigate("/security-admin")}>Security Incidents</button>
            <button className="action-link" onClick={() => navigate("/system-admin")}>System Status Monitor</button>
          </div>
        </div>

        <div className="card doctor-alerts-card">
          <h3>Right Insights Panel</h3>
          <div className="alert-stack">
            <div className="action-pill">Active Sessions: {data?.activeHospitals ?? "—"}</div>
            <div className="action-pill">Pending Requests: {data?.pendingRequests ?? "—"}</div>
            <div className="action-pill">Invoices: {data?.invoicesThisMonth ?? "—"}</div>
            <button className="btn-secondary" onClick={() => navigate("/admin/notifications")}>Open Alerts</button>
          </div>
        </div>
      </section>

      <section className="section">
        <h3>System Administration</h3>
        <div className="action-list">
          <button className="action-link" onClick={() => navigate("/admin/realtime")}>Integration Hub</button>
          <button className="action-link" onClick={() => navigate("/admin/crdt-patients")}>Offline Sync</button>
          <button className="action-link" onClick={() => navigate("/admin/audit-logs")}>Audit Trails</button>
          <button className="action-link" onClick={() => navigate("/reports")}>Regulatory Reports</button>
        </div>
      </section>
    </div>
  );
}
