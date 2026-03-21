import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { useAuth } from "../../utils/auth";
import { getStaffDashboard } from "../../services/dashboardApi";
import { listTransfers } from "../../services/transferApi";

export default function StaffDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");

  useEffect(() => {
    getStaffDashboard().then(setData).catch(() => setData(null));
  }, []);

  useEffect(() => {
    listTransfers({ limit: 6, scope: "facility" })
      .then((resp) => {
        const items = Array.isArray(resp?.items) ? resp.items : Array.isArray(resp) ? resp : [];
        setTransfers(items);
        setTransferError("");
      })
      .catch((err) => {
        setTransfers([]);
        setTransferError(err?.message || "Unable to load transfers.");
      });
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

  const roleWorkspacePath =
    role === "RADIOLOGIST"
      ? "/ops/imaging"
      : role === "THERAPIST"
      ? "/doctor/appointments"
      : role === "RECEPTIONIST"
      ? "/receptionist/booking-desk"
      : "/workforce/requests";

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>{roleTitle}</h2>
          <p className="muted">Simple staff view for requests, queues, and alerts.</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-primary" onClick={() => navigate("/workforce/requests")}>Open Workspace</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/workforce/requests")}>My Requests</button>
        </div>
      </div>

      <section className="section">
        <h3>Daily Summary</h3>
        <div className="grid info-grid">
          <StatCard title="My Pending Requests" value={data?.myPendingRequests ?? "—"} onClick={() => navigate("/workforce/requests")} />
          <StatCard title="Hospital Pending Requests" value={data?.hospitalPendingRequests ?? "—"} onClick={() => navigate("/workforce/requests")} />
          <StatCard title="Unread Notifications" value={data?.notificationsUnread ?? "—"} onClick={() => navigate("/notifications")} />
          <StatCard title="Appointments Today" value={data?.appointmentsToday ?? "—"} onClick={() => navigate(roleWorkspacePath)} />
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

      <section className="section">
        <div className="card">
          <div className="card-header-actions">
            <div>
              <h3>Transfer Continuity</h3>
              <p className="muted">Recent transfers and handoff status.</p>
            </div>
            <div className="action-pill">
              Pending: {transfers.filter((t) => t.status === "Pending").length}
            </div>
          </div>
          {transferError ? <div className="muted">{transferError}</div> : null}
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="doctor-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Route</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t) => (
                  <tr key={t._id}>
                    <td>{t?.patient?.firstName || ""} {t?.patient?.lastName || ""}</td>
                    <td>{t?.fromHospital?.name || t?.fromHospital?.code || "—"} → {t?.toHospital?.name || t?.toHospital?.code || "—"}</td>
                    <td>{t.status}</td>
                  </tr>
                ))}
                {transfers.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="muted">No transfers yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
