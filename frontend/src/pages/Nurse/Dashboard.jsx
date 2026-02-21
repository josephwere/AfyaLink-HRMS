import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { useAuth } from "../../utils/auth";
import { getNurseDashboard } from "../../services/dashboardApi";

export default function NurseDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    getNurseDashboard().then(setData).catch(() => setData(null));
  }, []);

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Nurse Clinical Operations</h2>
          <p className="muted">Shift execution, patient assignment, medication administration and incident logging.</p>
        </div>
        <div className="welcome-actions">
          <button className="btn-primary" onClick={() => navigate("/nurse")}>My Shift</button>
          <button className="btn-secondary" onClick={() => navigate("/nurse")}>Assigned Patients</button>
          <button className="btn-secondary" onClick={() => navigate("/workforce/requests#leave")}>Leave Requests</button>
        </div>
      </div>

      <section className="section">
        <h3>Nursing Snapshot</h3>
        <div className="grid info-grid">
          <StatCard title="Shift Info" value="Active" />
          <StatCard title="Assigned Patients" value={data?.patientsTotal ?? "—"} />
          <StatCard title="Medication Due Alerts" value={data?.pendingLabOrders ?? "—"} />
          <StatCard title="Pending Requests" value={data?.pendingRequests?.total ?? "—"} />
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <h3>Center Workspace</h3>
          <div className="panel-grid">
            <button className="action-link" onClick={() => navigate("/nurse")}>Patient Task List</button>
            <button className="action-link" onClick={() => navigate("/nurse")}>Medication Administration</button>
            <button className="action-link" onClick={() => navigate("/nurse")}>Vitals Entry</button>
            <button className="action-link" onClick={() => navigate("/nurse")}>Incident Reports</button>
          </div>
        </div>

        <div className="card doctor-alerts-card">
          <h3>Right Panel</h3>
          <div className="alert-stack">
            <div className="action-pill">Critical Alerts: {data?.appointmentsToday ?? "—"}</div>
            <div className="action-pill">Leave Pending: {data?.pendingRequests?.leave ?? "—"}</div>
            <button className="btn-secondary" onClick={() => navigate("/workforce/requests")}>Open My Requests</button>
          </div>
        </div>
      </section>
    </div>
  );
}
