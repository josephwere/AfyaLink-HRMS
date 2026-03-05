import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { getTherapistDashboard } from "../../services/dashboardApi";

export default function TherapistDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    getTherapistDashboard().then(setData).catch(() => setData(null));
  }, []);

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Therapist Dashboard</h2>
          <p className="muted">Simple therapy view for sessions and follow-up.</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-primary" onClick={() => navigate("/workforce/requests")}>
            My Requests
          </button>
        </div>
      </div>

      <section className="section">
        <h3>Therapy Workload</h3>
        <div className="grid info-grid">
          <StatCard title="Appointments Today" value={data?.appointmentsToday ?? "—"} />
          <StatCard title="Upcoming Appointments" value={data?.upcomingAppointments ?? "—"} />
          <StatCard title="Unread Notifications" value={data?.unreadNotifications ?? "—"} />
          <StatCard title="My Pending Requests" value={data?.myPendingRequests ?? "—"} />
        </div>
      </section>
    </div>
  );
}

