import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { getReceptionistDashboard } from "../../services/dashboardApi";

export default function ReceptionistDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    getReceptionistDashboard().then(setData).catch(() => setData(null));
  }, []);

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Receptionist Dashboard</h2>
          <p className="muted">Simple front desk view for booking and patient check-in.</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-primary" onClick={() => navigate("/workforce/requests")}>
            My Requests
          </button>
        </div>
      </div>

      <section className="section">
        <h3>Front Desk Summary</h3>
        <div className="grid info-grid">
          <StatCard title="Appointments Today" value={data?.appointmentsToday ?? "—"} />
          <StatCard title="Patients Total" value={data?.patientsTotal ?? "—"} />
          <StatCard title="Unread Notifications" value={data?.unreadNotifications ?? "—"} />
          <StatCard title="My Pending Requests" value={data?.myPendingRequests ?? "—"} />
        </div>
      </section>
    </div>
  );
}

