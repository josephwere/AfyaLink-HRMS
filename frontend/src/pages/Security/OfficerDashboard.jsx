import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { useAuth } from "../../utils/auth";
import { getSecurityOfficerDashboard } from "../../services/dashboardApi";

export default function SecurityOfficerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    getSecurityOfficerDashboard().then(setData).catch(() => setData(null));
  }, []);

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Security Officer Field Console</h2>
          <p className="muted">Current shift execution, visitor flow, gate scanning and incident response.</p>
        </div>
        <div className="welcome-actions">
          <button className="btn-primary" onClick={() => navigate("/security-officer")}>My Shift</button>
          <button className="btn-secondary" onClick={() => navigate("/security-officer")}>Visitor Check-In</button>
          <button className="btn-secondary" onClick={() => navigate("/security-officer")}>Emergency Alert</button>
        </div>
      </div>

      <section className="section">
        <h3>Shift & Zone</h3>
        <div className="grid info-grid">
          <StatCard title="Current Shift" value="Active" />
          <StatCard title="Assigned Zone" value={user?.hospital || "Main"} />
          <StatCard title="Open Incidents" value={data?.openIncidents ?? "—"} />
          <StatCard title="Incidents Today" value={data?.incidentsToday ?? "—"} />
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <h3>Center Operations</h3>
          <div className="panel-grid">
            <button className="action-link" onClick={() => navigate("/security-officer")}>QR Scanner Panel</button>
            <button className="action-link" onClick={() => navigate("/security-officer")}>Visitor Log Table</button>
            <button className="action-link" onClick={() => navigate("/security-officer")}>Patrol Logs</button>
          </div>
        </div>
        <div className="card doctor-alerts-card">
          <h3>Right Actions</h3>
          <div className="alert-stack">
            <button className="btn-secondary" onClick={() => navigate("/security-officer")}>Incident Quick Form</button>
            <button className="btn-secondary" onClick={() => navigate("/security-officer")}>Alert Button</button>
          </div>
        </div>
      </section>
    </div>
  );
}
