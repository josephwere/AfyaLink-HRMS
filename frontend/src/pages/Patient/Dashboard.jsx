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
          <p className="muted">Simple patient view for appointments, results, bills, and insurance.</p>
        </div>
        <div className="welcome-actions">
          <button className="btn-primary" type="button" onClick={() => navigate("/patient/appointments")}>My Appointments</button>
          <button className="btn-secondary" type="button" onClick={() => navigate("/payments")}>Billing</button>
          <button className="btn-secondary" type="button" onClick={() => navigate("/patient/ads")}>Vacancy Feed</button>
          <button className="btn-secondary" type="button" onClick={() => navigate("/profile")}>Profile</button>
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
            <button className="action-link" type="button" onClick={() => navigate("/patient/medical-records")}>Medical Records</button>
            <button className="action-link" type="button" onClick={() => navigate("/patient/prescriptions")}>Prescriptions</button>
            <button className="action-link" type="button" onClick={() => navigate("/patient/lab-results")}>Lab Results</button>
            <button className="action-link" type="button" onClick={() => navigate("/patient/insurance")}>Insurance</button>
            <button className="action-link" type="button" onClick={() => navigate("/patient/ads")}>Vacancy Feed</button>
          </div>
        </div>
        <div className="card doctor-alerts-card">
          <h3>Notifications</h3>
          <div className="alert-stack">
            <button className="btn-secondary" type="button" onClick={() => navigate("/notifications")}>Messages</button>
            <button className="btn-secondary" type="button" onClick={() => navigate("/patient/feedback")}>Feedback</button>
          </div>
        </div>
      </section>
    </div>
  );
}
