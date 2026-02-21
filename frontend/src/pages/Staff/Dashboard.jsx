import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { useAuth } from "../../utils/auth";
import { getStaffDashboard } from "../../services/dashboardApi";

export default function StaffDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    getStaffDashboard().then(setData).catch(() => setData(null));
  }, []);

  const role = useMemo(() => String(user?.role || "").toUpperCase(), [user?.role]);

  const roleTitle =
    role === "RADIOLOGIST"
      ? "Radiologist Workspace"
      : role === "THERAPIST"
      ? "Therapist Workspace"
      : role === "RECEPTIONIST"
      ? "Receptionist Workspace"
      : "Staff Workspace";

  const rolePanels =
    role === "RADIOLOGIST"
      ? ["Imaging Queue", "Scan Viewer", "Report Editor", "Equipment Logs", "AI Assistance Overlay"]
      : role === "THERAPIST"
      ? ["Session Schedule", "Patient Notes", "Treatment Plans", "Progress Tracking", "Follow-up Planner"]
      : ["Appointment Scheduling", "Patient Check-In", "Billing Initiation", "Queue Management", "Visitor Log"];

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>{roleTitle}</h2>
          <p className="muted">Role-specific operational dashboard with requests, queues and alerts.</p>
        </div>
        <div className="welcome-actions">
          <button className="btn-primary" onClick={() => navigate("/staff")}>Open Workspace</button>
          <button className="btn-secondary" onClick={() => navigate("/workforce/requests")}>My Requests</button>
        </div>
      </div>

      <section className="section">
        <h3>Daily Summary</h3>
        <div className="grid info-grid">
          <StatCard title="My Pending Requests" value={data?.myPendingRequests ?? "—"} />
          <StatCard title="Hospital Pending Requests" value={data?.hospitalPendingRequests ?? "—"} />
          <StatCard title="Unread Notifications" value={data?.notificationsUnread ?? "—"} />
          <StatCard title="Appointments Today" value={data?.appointmentsToday ?? "—"} />
        </div>
      </section>

      <section className="section">
        <h3>Role Workspace</h3>
        <div className="panel-grid">
          {rolePanels.map((p) => (
            <div className="panel" key={p}>{p}</div>
          ))}
        </div>
      </section>
    </div>
  );
}
