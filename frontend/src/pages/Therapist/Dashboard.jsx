import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { getTherapistDashboard } from "../../services/dashboardApi";
import { listTransfers } from "../../services/transferApi";
import { useAppLanguage } from "../../utils/appLanguage.jsx";

export default function TherapistDashboard() {
  const navigate = useNavigate();
  const { translateText } = useAppLanguage();
  const [data, setData] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");

  useEffect(() => {
    getTherapistDashboard().then(setData).catch(() => setData(null));
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
          <h2>{translateText("Therapist Dashboard")}</h2>
          <p className="muted">{translateText("Simple therapy view for sessions and follow-up.")}</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-primary" onClick={() => navigate("/workforce/requests")}>
            {translateText("My Requests")}
          </button>
        </div>
      </div>

      <section className="section">
        <h3>{translateText("Therapy Workload")}</h3>
        <div className="grid info-grid">
          <StatCard title={translateText("Appointments Today")} value={data?.appointmentsToday ?? "—"} onClick={() => navigate("/doctor/appointments")} />
          <StatCard title={translateText("Upcoming Appointments")} value={data?.upcomingAppointments ?? "—"} onClick={() => navigate("/doctor/appointments")} />
          <StatCard title={translateText("Unread Notifications")} value={data?.unreadNotifications ?? "—"} onClick={() => navigate("/notifications")} />
          <StatCard title={translateText("My Pending Requests")} value={data?.myPendingRequests ?? "—"} onClick={() => navigate("/workforce/requests")} />
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <div className="card-header-actions">
            <div>
              <h3>{translateText("Transfer Continuity")}</h3>
              <p className="muted">{translateText("Recent transfers and handoff status.")}</p>
            </div>
            <div className="action-pill">{translateText("Pending")}: {transfers.filter((t) => t.status === "Pending").length}</div>
          </div>
          {transferError ? <div className="muted">{translateText(transferError)}</div> : null}
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="doctor-table">
              <thead>
                <tr>
                  <th>{translateText("Patient")}</th>
                  <th>{translateText("Route")}</th>
                  <th>{translateText("Status")}</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t) => (
                  <tr key={t._id}>
                    <td>{t?.patient?.firstName || ""} {t?.patient?.lastName || ""}</td>
                    <td>{t?.fromHospital?.name || t?.fromHospital?.code || "—"} → {t?.toHospital?.name || t?.toHospital?.code || "—"}</td>
                    <td>{translateText(t.status)}</td>
                  </tr>
                ))}
                {transfers.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="muted">{translateText("No transfers yet.")}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="doctor-actions-row" style={{ marginTop: 12 }}>
            <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/transfer-command-center")}>
              {translateText("Transfer Command Center")}
            </button>
            <button type="button" className="btn-secondary" onClick={() => navigate("/workforce/requests")}>
              {translateText("My Requests")}
            </button>
          </div>
        </div>
        <div className="card doctor-alerts-card">
          <h3>{translateText("Continuity Actions")}</h3>
          <div className="alert-stack">
            <div className="alert-item">{translateText("Share therapy plan updates before transfer completion.")}</div>
            <div className="alert-item">{translateText("Flag rehab needs in handover summary.")}</div>
            <div className="alert-item">{translateText("Coordinate follow-up sessions with receiving team.")}</div>
          </div>
        </div>
      </section>
    </div>
  );
}
