import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { getSurgeonDashboard } from "../../services/dashboardApi";

export default function SurgeonDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    getSurgeonDashboard().then(setData).catch(() => setData(null));
  }, []);

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Surgeon Dashboard</h2>
          <p className="muted">Simple surgery view for theatre schedule and follow-up.</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-primary" onClick={() => navigate("/doctor/surgery")}>
            Surgery Workspace
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/workforce/requests")}>
            My Requests
          </button>
        </div>
      </div>

      <section className="section">
        <h3>Surgical Summary</h3>
        <div className="grid info-grid">
          <StatCard title="Surgeries Today" value={data?.surgeriesToday ?? "—"} />
          <StatCard title="Upcoming Surgeries" value={data?.upcomingSurgeries ?? "—"} />
          <StatCard title="Active Encounters" value={data?.activeEncounters ?? "—"} />
          <StatCard title="Unread Notifications" value={data?.unreadNotifications ?? "—"} />
        </div>
      </section>
    </div>
  );
}

