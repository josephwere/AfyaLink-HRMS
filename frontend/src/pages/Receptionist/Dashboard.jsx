import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { getReceptionistDashboard } from "../../services/dashboardApi";
import { listTransfers } from "../../services/transferApi";

export default function ReceptionistDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");

  useEffect(() => {
    getReceptionistDashboard().then(setData).catch(() => setData(null));
    listTransfers({ limit: 6, scope: "facility" })
      .then((res) => {
        const items = Array.isArray(res?.items) ? res.items : [];
        setTransfers(items);
        setTransferError("");
      })
      .catch((err) => {
        setTransfers([]);
        setTransferError(err?.message || "Failed to load transfers.");
      });
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
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate("/receptionist/booking-desk")}
            data-ai-action="open-booking-desk"
            data-ai-label="Open Booking Desk"
            data-ai-aliases="front desk booking|open booking workflow|go to booking desk"
            data-ai-help="Navigate to the receptionist booking desk workflow."
          >
            Booking Desk
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

      <section className="section">
        <h3>Main Tasks</h3>
        <div className="panel-grid">
          <button
            type="button"
            className="action-link"
            onClick={() => navigate("/receptionist/booking-desk")}
            data-ai-action="open-booking-desk"
            data-ai-label="Open Fast Hospital Booking"
            data-ai-aliases="fast booking|front desk booking|booking task"
            data-ai-help="Navigate to the fast hospital booking workflow."
          >
            Fast Hospital Booking
          </button>
          <button
            type="button"
            className="action-link"
            onClick={() => navigate("/notifications")}
            data-ai-action="open-front-desk-messages"
            data-ai-label="Open Front Desk Messages"
            data-ai-aliases="notifications|messages|front desk inbox"
            data-ai-help="Navigate to receptionist notifications and messages."
          >
            Front Desk Messages
          </button>
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <div className="card-header-actions">
            <div>
              <h3>Transfer Continuity</h3>
              <p className="muted">Recent transfers and handoff status.</p>
            </div>
            <div className="action-pill">Pending: {transfers.filter((t) => t.status === "Pending").length}</div>
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
          <div className="doctor-actions-row" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate("/hospital-admin/transfer-command-center")}
              data-ai-action="open-transfer-command-center"
              data-ai-label="Open Transfer Command Center"
              data-ai-aliases="transfer command center|handover desk|transfer workflow"
              data-ai-help="Navigate to the transfer command center for hospital handoffs."
            >
              Transfer Command Center
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate("/receptionist/booking-desk")}
              data-ai-action="open-booking-desk"
              data-ai-label="Open Booking Desk"
              data-ai-aliases="booking desk|front desk booking|booking workflow"
              data-ai-help="Navigate to the receptionist booking desk workflow."
            >
              Booking Desk
            </button>
          </div>
        </div>
        <div className="card doctor-alerts-card">
          <h3>Continuity Actions</h3>
          <div className="alert-stack">
            <div className="alert-item">Confirm receiving hospital details before check-in.</div>
            <div className="alert-item">Direct patients to transfer handover desk if pending.</div>
            <div className="alert-item">Notify clinicians when transfer arrivals are on-site.</div>
          </div>
        </div>
      </section>
    </div>
  );
}
