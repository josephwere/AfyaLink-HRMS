import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { useAuth } from "../../utils/auth";
import { getSecurityAdminDashboard } from "../../services/dashboardApi";

export default function SecurityAdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    getSecurityAdminDashboard().then(setData).catch(() => setData(null));
  }, []);

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Security Governance Dashboard</h2>
          <p className="muted">Access control, visitor management, incident response and device authorization.</p>
        </div>
        <div className="welcome-actions">
          <button className="btn-primary" onClick={() => navigate("/security-admin")}>Access Logs</button>
          <button className="btn-secondary" onClick={() => navigate("/admin/notifications")}>Suspicious Alerts</button>
          <button className="btn-secondary" onClick={() => navigate("/reports")}>Compliance Reports</button>
        </div>
      </div>

      <section className="section">
        <h3>Security Snapshot</h3>
        <div className="grid info-grid">
          <StatCard title="Active Access Points" value={data?.officersActive ?? "—"} />
          <StatCard title="Open Incidents" value={data?.openIncidents ?? "—"} />
          <StatCard title="Escalated Incidents" value={data?.escalatedIncidents ?? "—"} />
          <StatCard title="Incidents Today" value={data?.incidentsToday ?? "—"} />
        </div>
      </section>

      <section className="section">
        <h3>Security Control Panels</h3>
        <div className="panel-grid">
          <button className="action-link" onClick={() => navigate("/security-admin")}>Clearance Levels</button>
          <button className="action-link" onClick={() => navigate("/security-admin")}>Visitor Management</button>
          <button className="action-link" onClick={() => navigate("/security-admin")}>Device Authorization</button>
          <button className="action-link" onClick={() => navigate("/security-admin")}>Emergency Protocols</button>
          <button className="action-link" onClick={() => navigate("/security-admin")}>Blacklist Database</button>
        </div>
      </section>
    </div>
  );
}
