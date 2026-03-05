import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { getOncologyDaycareDashboard } from "../../services/dashboardApi";

export default function OncologyDaycareDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    getOncologyDaycareDashboard().then(setData).catch(() => setData(null));
  }, []);

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Oncology Day-Care Dashboard</h2>
          <p className="muted">Simple view for oncology cycles and pending care.</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-primary" onClick={() => navigate("/doctor/appointments")}>Open Appointments</button>
        </div>
      </div>
      <section className="section">
        <h3>Live Metrics</h3>
        <div className="grid info-grid">
          <StatCard title="Cycles Today" value={data?.cyclesToday ?? "-"} />
          <StatCard title="Upcoming Cycles" value={data?.upcomingCycles ?? "-"} />
          <StatCard title="Active Oncology Cases" value={data?.activeOncologyCases ?? "-"} />
          <StatCard title="Pending Chemo Orders" value={data?.pendingChemoOrders ?? "-"} />
        </div>
      </section>
    </div>
  );
}
