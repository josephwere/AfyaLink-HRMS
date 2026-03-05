import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { getRadiologistDashboard } from "../../services/dashboardApi";

export default function RadiologistDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    getRadiologistDashboard().then(setData).catch(() => setData(null));
  }, []);

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Radiologist Dashboard</h2>
          <p className="muted">Simple imaging view for orders, reports, and turnaround.</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-primary" onClick={() => navigate("/workforce/requests")}>
            My Requests
          </button>
        </div>
      </div>

      <section className="section">
        <h3>Imaging Operations</h3>
        <div className="grid info-grid">
          <StatCard title="Pending Imaging Orders" value={data?.pendingImagingOrders ?? "—"} />
          <StatCard title="Completed Today" value={data?.completedToday ?? "—"} />
          <StatCard title="Unread Notifications" value={data?.unreadNotifications ?? "—"} />
          <StatCard title="My Pending Requests" value={data?.myPendingRequests ?? "—"} />
        </div>
      </section>
    </div>
  );
}

