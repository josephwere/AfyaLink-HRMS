import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import apiFetch from "../../utils/apiFetch";
import { listTransfers } from "../../services/transferApi";
import { useAppLanguage } from "../../utils/appLanguage.jsx";

export default function PharmacyDashboard() {
  const navigate = useNavigate();
  const { translateText } = useAppLanguage();
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
          <h2>{translateText("Pharmacy Dashboard")}</h2>
          <p className="muted">{translateText("Simple pharmacy view for dispensing, stock, and expiry checks.")}</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-primary" onClick={() => navigate("/pharmacy/queue")}>{translateText("Prescription Queue")}</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/pharmacy/inventory")}>{translateText("Inventory")}</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/pharmacy/reports")}>{translateText("Reports")}</button>
        </div>
      </div>

      <section className="section">
        <h3>{translateText("Pharmacy Snapshot")}</h3>
        <div className="grid info-grid">
          <StatCard title={translateText("Pending Prescriptions")} value={pendingPrescriptions} onClick={() => navigate("/pharmacy/queue")} />
          <StatCard title={translateText("Dispensed")} value={dispensedToday} onClick={() => navigate("/pharmacy/queue")} />
          <StatCard title={translateText("Low Stock Alerts")} value={lowStock} onClick={() => navigate("/pharmacy/inventory")} />
          <StatCard title={translateText("Expiring Drugs")} value={translateText("Live")} onClick={() => navigate("/pharmacy/expiry")} />
          <StatCard title={translateText("Controlled Drugs")} value={translateText("Tracked")} onClick={() => navigate("/pharmacy/controlled")} />
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <h3>{translateText("Dispensing Queue")}</h3>
          <div className="table-wrap">
            <table className="doctor-table">
              <thead>
                <tr><th>{translateText("Patient")}</th><th>{translateText("Prescription")}</th><th>{translateText("Status")}</th><th>{translateText("Doctor")}</th></tr>
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
                    <td>{translateText(i.status)}</td>
                    <td>{i?.doctor?.name || "-"}</td>
                  </tr>
                ))}
                {prescriptions.length === 0 && <tr><td colSpan="4" className="muted">{translateText("No prescriptions")}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card doctor-alerts-card">
          <h3>{translateText("Interaction Alerts")}</h3>
          <div className="alert-stack">
            <div className="action-pill">{translateText("Drug interaction checks active")}</div>
            <button type="button" className="btn-secondary" onClick={() => navigate("/pharmacy/reports")}>{translateText("Open Safety Reports")}</button>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="card">
          <div className="card-header-actions">
            <div>
              <h3>{translateText("Transfer Continuity")}</h3>
              <p className="muted">{translateText("Recent transfers and handoff status.")}</p>
            </div>
            <div className="action-pill">
              {translateText("Pending")}: {transfers.filter((t) => t.status === "Pending").length}
            </div>
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
        </div>
      </section>
    </div>
  );
}
