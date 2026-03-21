import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { useAuth } from "../../utils/auth";
import { getLabTechDashboard } from "../../services/dashboardApi";
import { listTransfers } from "../../services/transferApi";

export default function LabTechDashboard() {
  const { user } = useAuth();
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
          <h2>Lab Technician Diagnostics</h2>
          <p className="muted">Simple lab view for test queue, samples, and quality checks.</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-primary" onClick={() => navigate("/lab-tech/test-queue")}>Test Queue</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/lab-tech/equipment")}>Equipment Logs</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/lab-tech/archive")}>Reports Archive</button>
        </div>
      </div>

      <section className="section">
        <h3>Lab Metrics</h3>
        <div className="grid info-grid">
          <StatCard title="Pending Tests" value={data?.pendingOrders ?? "—"} onClick={() => navigate("/lab-tech/test-queue")} />
          <StatCard title="Completed Today" value={data?.completedToday ?? "—"} onClick={() => navigate("/lab-tech/archive")} />
          <StatCard title="Abnormal Results" value={data?.overdueOrders ?? "—"} onClick={() => navigate("/lab-tech/qc")} />
          <StatCard title="Orders Today" value={data?.ordersToday ?? "—"} onClick={() => navigate("/lab-tech/test-queue")} />
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <h3>Main Tasks</h3>
          <div className="panel-grid">
            <button type="button" className="action-link" onClick={() => navigate("/lab-tech/test-queue")}>Test Processing Table</button>
            <button type="button" className="action-link" onClick={() => navigate("/lab-tech/samples")}>Sample Tracking</button>
            <button type="button" className="action-link" onClick={() => navigate("/lab-tech/qc")}>Quality Control</button>
            <button type="button" className="action-link" onClick={() => navigate("/lab-tech/safety")}>Safety Checklist</button>
          </div>
        </div>

        <div className="card doctor-alerts-card">
          <h3>Alerts</h3>
          <div className="alert-stack">
            <div className="action-pill">Equipment Status: Live</div>
            <div className="action-pill">Urgent Flagged: {data?.overdueOrders ?? "—"}</div>
          </div>
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
            <button type="button" className="btn-secondary" onClick={() => navigate("/lab-tech/test-queue")}>
              Test Queue
            </button>
            <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/transfer-command-center")}>
              Transfer Command Center
            </button>
          </div>
        </div>
        <div className="card doctor-alerts-card">
          <h3>Continuity Actions</h3>
          <div className="alert-stack">
            <div className="alert-item">Attach pending results before transfer completion.</div>
            <div className="alert-item">Flag abnormal labs for receiving team.</div>
            <div className="alert-item">Coordinate sample handoff when needed.</div>
          </div>
        </div>
      </section>
    </div>
  );
}
