import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { useAuth } from "../../utils/auth";
import { getLabTechDashboard } from "../../services/dashboardApi";

export default function LabTechDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    getLabTechDashboard().then(setData).catch(() => setData(null));
  }, []);

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Lab Technician Diagnostics</h2>
          <p className="muted">Test queue, sample tracking, quality control and equipment readiness.</p>
        </div>
        <div className="welcome-actions">
          <button className="btn-primary" onClick={() => navigate("/labtech/labs")}>Test Queue</button>
          <button className="btn-secondary" onClick={() => navigate("/lab-tech")}>Equipment Logs</button>
          <button className="btn-secondary" onClick={() => navigate("/reports")}>Reports Archive</button>
        </div>
      </div>

      <section className="section">
        <h3>Lab Metrics</h3>
        <div className="grid info-grid">
          <StatCard title="Pending Tests" value={data?.pendingOrders ?? "—"} />
          <StatCard title="Completed Today" value={data?.completedToday ?? "—"} />
          <StatCard title="Abnormal Results" value={data?.overdueOrders ?? "—"} />
          <StatCard title="Orders Today" value={data?.ordersToday ?? "—"} />
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <h3>Center Workspace</h3>
          <div className="panel-grid">
            <button className="action-link" onClick={() => navigate("/labtech/labs")}>Test Processing Table</button>
            <button className="action-link" onClick={() => navigate("/lab-tech")}>Sample Tracking</button>
            <button className="action-link" onClick={() => navigate("/lab-tech")}>Quality Control</button>
            <button className="action-link" onClick={() => navigate("/lab-tech")}>Safety Checklist</button>
          </div>
        </div>

        <div className="card doctor-alerts-card">
          <h3>Right Insights</h3>
          <div className="alert-stack">
            <div className="action-pill">Equipment Status: Live</div>
            <div className="action-pill">Urgent Flagged: {data?.overdueOrders ?? "—"}</div>
          </div>
        </div>
      </section>
    </div>
  );
}
