import React, { useEffect, useState } from "react";
import ModuleWorkspace from "../../components/ModuleWorkspace";
import { listTransfers } from "../../services/transferApi";

export default function ExpiryAlerts() {
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");

  useEffect(() => {
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
      <ModuleWorkspace
        title="Expiry Alerts"
        subtitle="Medication expiry surveillance and near-expiry action workflow."
        actions={[
          { label: "Review Alerts", variant: "primary", path: "/pharmacy/expiry#review" },
          { label: "Quarantine Batch", path: "/pharmacy/expiry#quarantine" },
        ]}
        panels={[
          { title: "Near Expiry", body: "Batches approaching expiry." },
          { title: "Expired", body: "Expired items requiring disposal records." },
          { title: "Actions", body: "Return, quarantine and replacement actions." },
        ]}
      />

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
        </div>
        <div className="card doctor-alerts-card">
          <h3>Continuity Actions</h3>
          <div className="alert-stack">
            <div className="alert-item">Quarantine near-expiry items before transfer.</div>
            <div className="alert-item">Attach expiry checks to handover summary.</div>
            <div className="alert-item">Coordinate replacements for expiring stock.</div>
          </div>
        </div>
      </section>
    </div>
  );
}
