import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import apiFetch from "../../utils/apiFetch";
import { listTransfers } from "../../services/transferApi";

export default function PharmacyDashboard() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");

  useEffect(() => {
    apiFetch("/api/pharmacy?limit=25")
      .then((res) => setItems(Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : []))
      .catch(() => setItems([]));
    apiFetch("/api/pharmacy/prescriptions")
      .then((res) => setPrescriptions(Array.isArray(res?.items) ? res.items : []))
      .catch(() => setPrescriptions([]));
    listTransfers({ limit: 6, scope: "facility" })
      .then((data) => {
        const itemsList = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
        setTransfers(itemsList);
        setTransferError("");
      })
      .catch((err) => {
        setTransfers([]);
        setTransferError(err?.message || "Unable to load transfers.");
      });
  }, []);

  const lowStock = items.filter((i) => Number(i?.qty || 0) <= Number(i?.minStock || 0)).length;
  const pendingPrescriptions = prescriptions.filter((item) => item.status === "CREATED").length;
  const dispensedToday = prescriptions.filter((item) => item.status === "DISPENSED").length;

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Pharmacy Dashboard</h2>
          <p className="muted">Simple pharmacy view for dispensing, stock, and expiry checks.</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-primary" onClick={() => navigate("/pharmacy/queue")}>Prescription Queue</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/pharmacy/inventory")}>Inventory</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/pharmacy/reports")}>Reports</button>
        </div>
      </div>

      <section className="section">
        <h3>Pharmacy Snapshot</h3>
        <div className="grid info-grid">
          <StatCard title="Pending Prescriptions" value={pendingPrescriptions} onClick={() => navigate("/pharmacy/queue")} />
          <StatCard title="Dispensed" value={dispensedToday} onClick={() => navigate("/pharmacy/queue")} />
          <StatCard title="Low Stock Alerts" value={lowStock} />
          <StatCard title="Expiring Drugs" value="Live" />
          <StatCard title="Controlled Drugs" value="Tracked" />
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <h3>Dispensing Queue</h3>
          <div className="table-wrap">
            <table className="doctor-table">
              <thead>
                <tr><th>Patient</th><th>Prescription</th><th>Status</th><th>Doctor</th></tr>
              </thead>
              <tbody>
                {prescriptions.slice(0, 10).map((i) => (
                  <tr key={i._id}>
                    <td>
                      {i?.patientRecord?.firstName
                        ? `${i.patientRecord.firstName} ${i.patientRecord.lastName || ""}`.trim()
                        : "-"}
                    </td>
                    <td>{i.summary || i?.appointment?.serviceType || "-"}</td>
                    <td>{i.status}</td>
                    <td>{i?.doctor?.name || "-"}</td>
                  </tr>
                ))}
                {prescriptions.length === 0 && <tr><td colSpan="4" className="muted">No prescriptions</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card doctor-alerts-card">
          <h3>Interaction Alerts</h3>
          <div className="alert-stack">
            <div className="action-pill">Drug interaction checks active</div>
            <button type="button" className="btn-secondary" onClick={() => navigate("/pharmacy/reports")}>Open Safety Reports</button>
          </div>
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
