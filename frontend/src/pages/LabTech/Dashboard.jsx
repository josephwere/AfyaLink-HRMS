import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { useAuth } from "../../utils/auth";
import { getLabTechDashboard } from "../../services/dashboardApi";
import { listTransfers } from "../../services/transferApi";
import { useAppLanguage } from "../../utils/appLanguage.jsx";

export default function LabTechDashboard() {
  const { user } = useAuth();
  const { translateText } = useAppLanguage();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");

  useEffect(() => {
    getLabTechDashboard().then(setData).catch(() => setData(null));
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
          <h2>{translateText("Lab Technician Diagnostics")}</h2>
          <p className="muted">{translateText("Simple lab view for test queue, samples, and quality checks.")}</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-primary" onClick={() => navigate("/lab-tech/test-queue")}>{translateText("Test Queue")}</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/lab-tech/equipment")}>{translateText("Equipment Logs")}</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/lab-tech/archive")}>{translateText("Reports Archive")}</button>
        </div>
      </div>

      <section className="section">
        <h3>{translateText("Lab Metrics")}</h3>
        <div className="grid info-grid">
          <StatCard title={translateText("Pending Tests")} value={data?.pendingOrders ?? "—"} onClick={() => navigate("/lab-tech/test-queue")} />
          <StatCard title={translateText("Completed Today")} value={data?.completedToday ?? "—"} onClick={() => navigate("/lab-tech/archive")} />
          <StatCard title={translateText("Abnormal Results")} value={data?.overdueOrders ?? "—"} onClick={() => navigate("/lab-tech/qc")} />
          <StatCard title={translateText("Orders Today")} value={data?.ordersToday ?? "—"} onClick={() => navigate("/lab-tech/test-queue")} />
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <h3>{translateText("Main Tasks")}</h3>
          <div className="panel-grid">
            <button type="button" className="action-link" onClick={() => navigate("/lab-tech/test-queue")}>{translateText("Test Processing Table")}</button>
            <button type="button" className="action-link" onClick={() => navigate("/lab-tech/samples")}>{translateText("Sample Tracking")}</button>
            <button type="button" className="action-link" onClick={() => navigate("/lab-tech/qc")}>{translateText("Quality Control")}</button>
            <button type="button" className="action-link" onClick={() => navigate("/lab-tech/safety")}>{translateText("Safety Checklist")}</button>
          </div>
        </div>

        <div className="card doctor-alerts-card">
          <h3>{translateText("Alerts")}</h3>
          <div className="alert-stack">
            <div className="action-pill">{translateText("Equipment Status: Live")}</div>
            <div className="action-pill">{translateText("Urgent Flagged")}: {data?.overdueOrders ?? "—"}</div>
          </div>
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
            <button type="button" className="btn-secondary" onClick={() => navigate("/lab-tech/test-queue")}>
              {translateText("Test Queue")}
            </button>
            <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/transfer-command-center")}>
              {translateText("Transfer Command Center")}
            </button>
          </div>
        </div>
        <div className="card doctor-alerts-card">
          <h3>{translateText("Continuity Actions")}</h3>
          <div className="alert-stack">
            <div className="alert-item">{translateText("Attach pending results before transfer completion.")}</div>
            <div className="alert-item">{translateText("Flag abnormal labs for receiving team.")}</div>
            <div className="alert-item">{translateText("Coordinate sample handoff when needed.")}</div>
          </div>
        </div>
      </section>
    </div>
  );
}
