import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { useAuth } from "../../utils/auth";
import { getPatientDashboard } from "../../services/dashboardApi";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    getPatientDashboard().then(setData).catch(() => setData(null));
  }, []);

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Patient Self-Service Portal</h2>
          <p className="muted">Appointments, records, lab results, billing and insurance in one place.</p>
        </div>
        <div className="welcome-actions">
          <button className="btn-primary" onClick={() => navigate("/patient")}>My Appointments</button>
          <button className="btn-secondary" onClick={() => navigate("/payments")}>Billing</button>
          <button className="btn-secondary" onClick={() => navigate("/profile")}>Profile</button>
        </div>
      </div>

      <section className="section">
        <h3>Top Summary</h3>
        <div className="grid info-grid">
          <StatCard title="Upcoming Appointment" value={data?.upcomingAppointments ?? "—"} />
          <StatCard title="Outstanding Bill" value={data?.unpaidInvoices ?? "—"} />
          <StatCard title="Active Prescription" value={data?.prescriptionsActive ?? "—"} />
          <StatCard title="Lab Results" value={data?.labResults ?? "—"} />
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <h3>Health Timeline</h3>
          <div className="panel-grid">
            <button className="action-link" onClick={() => navigate("/patient")}>Medical Records</button>
            <button className="action-link" onClick={() => navigate("/patient")}>Prescriptions</button>
            <button className="action-link" onClick={() => navigate("/patient")}>Lab Results</button>
            <button className="action-link" onClick={() => navigate("/patient")}>Insurance</button>
          </div>
        </div>
        <div className="card doctor-alerts-card">
          <h3>Notifications</h3>
          <div className="alert-stack">
            <button className="btn-secondary" onClick={() => navigate("/admin/notifications")}>Messages</button>
            <button className="btn-secondary" onClick={() => navigate("/patient")}>Feedback</button>
          </div>
        </div>
      </section>
    </div>
  );
}
