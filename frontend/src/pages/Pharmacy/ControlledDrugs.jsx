import React, { useEffect, useState } from "react";
import ModuleWorkspace from "../../components/ModuleWorkspace";
import { listTransfers } from "../../services/transferApi";

export default function ControlledDrugs() {
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
        title="Controlled Drugs"
        subtitle="Controlled medication ledger, issue/return logs and compliance checks."
        actions={[
          { label: "Open Controlled Log", variant: "primary", path: "/pharmacy/controlled#log" },
          { label: "Audit Export", onClick: () => window.print() },
        ]}
        panels={[
          { title: "Dispense Log", body: "Controlled drug issue records." },
          { title: "Stock Checks", body: "Count reconciliation and discrepancy flags." },
          { title: "Compliance", body: "Regulatory controls and audit artifacts." },
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
            <div className="alert-item">Ensure controlled drug logs attach to transfer packet.</div>
            <div className="alert-item">Audit discrepancies before transfer completion.</div>
            <div className="alert-item">Coordinate controlled stock handoff with receiving pharmacy.</div>
          </div>
        </div>
      </section>
    </div>
  );
}
