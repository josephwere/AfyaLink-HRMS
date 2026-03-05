import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { getTriageOpsDashboard } from "../../services/dashboardApi";

export default function TriageOpsDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    getTriageOpsDashboard().then(setData).catch(() => setData(null));
  }, []);

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Triage Operations</h2>
          <p className="muted">Simple triage view for arrivals and urgent cases.</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-primary" onClick={() => navigate("/doctor/appointments")}>
            Open Appointments
          </button>
        </div>
      </div>
      <section className="section">
        <h3>Live Metrics</h3>
        <div className="grid info-grid">
          <StatCard title="Arrivals Today" value={data?.arrivalsToday ?? "—"} />
          <StatCard title="Pending Triage" value={data?.pendingTriage ?? "—"} />
          <StatCard title="Active Encounters" value={data?.activeEncounters ?? "—"} />
          <StatCard title="Urgent Lab Backlog" value={data?.urgentLabBacklog ?? "—"} />
        </div>
      </section>
    </div>
  );
}
