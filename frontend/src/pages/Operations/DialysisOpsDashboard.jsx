import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { getDialysisOpsDashboard } from "../../services/dashboardApi";

export default function DialysisOpsDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    getDialysisOpsDashboard().then(setData).catch(() => setData(null));
  }, []);

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Dialysis Ops Dashboard</h2>
          <p className="muted">Simple view for dialysis sessions and delays.</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-primary" onClick={() => navigate("/doctor/appointments")}>Open Appointments</button>
        </div>
      </div>
      <section className="section">
        <h3>Live Metrics</h3>
        <div className="grid info-grid">
          <StatCard title="Sessions Today" value={data?.sessionsToday ?? "-"} />
          <StatCard title="Upcoming Sessions" value={data?.upcomingSessions ?? "-"} />
          <StatCard title="Active Dialysis Cases" value={data?.activeDialysisCases ?? "-"} />
          <StatCard title="Delayed Sessions" value={data?.delayedSessions ?? "-"} />
        </div>
      </section>
    </div>
  );
}
