import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { getEmergencyCommandDashboard } from "../../services/dashboardApi";

export default function EmergencyCommandDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    getEmergencyCommandDashboard().then(setData).catch(() => setData(null));
  }, []);

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Emergency Command Dashboard</h2>
          <p className="muted">Simple view for emergency and dispatch flow.</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-primary" onClick={() => navigate("/ops/triage")}>Open Triage</button>
        </div>
      </div>
      <section className="section">
        <h3>Live Metrics</h3>
        <div className="grid info-grid">
          <StatCard title="Active Emergencies" value={data?.activeEmergencies ?? "-"} />
          <StatCard title="Escalated Incidents" value={data?.escalatedIncidents ?? "-"} />
          <StatCard title="Ambulance Dispatches Today" value={data?.ambulanceDispatchesToday ?? "-"} />
          <StatCard title="Triage Backlog" value={data?.triageBacklog ?? "-"} />
        </div>
      </section>
    </div>
  );
}
