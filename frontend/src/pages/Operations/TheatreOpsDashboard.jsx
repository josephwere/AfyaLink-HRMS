import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { getTheatreOpsDashboard } from "../../services/dashboardApi";

export default function TheatreOpsDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    getTheatreOpsDashboard().then(setData).catch(() => setData(null));
  }, []);

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Theatre Operations</h2>
          <p className="muted">Simple theatre view for surgery flow and post-op care.</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-primary" onClick={() => navigate("/doctor/surgery")}>
            Open Surgery Workspace
          </button>
        </div>
      </div>
      <section className="section">
        <h3>Live Metrics</h3>
        <div className="grid info-grid">
          <StatCard title="Surgeries Today" value={data?.surgeriesToday ?? "—"} />
          <StatCard title="Upcoming Surgeries" value={data?.upcomingSurgeries ?? "—"} />
          <StatCard title="Active Surgical Encounters" value={data?.activeSurgicalEncounters ?? "—"} />
          <StatCard title="Post-op Followups" value={data?.postOpFollowups ?? "—"} />
        </div>
      </section>
    </div>
  );
}
