import React from "react";
import ModuleWorkspace from "../../components/ModuleWorkspace";
import usePharmacyDashboard from "../../hooks/usePharmacyDashboard";

export default function PharmacyReportsPage() {
  const { transfers, error, loading } = usePharmacyDashboard({ limit: 25 });

  return (
    <div className="dashboard">
      <ModuleWorkspace
        title="Pharmacy Reports"
        subtitle="Dispense volumes, controlled logs and inventory audit reports."
        actions={[
          { label: "Open Reports", variant: "primary", path: "/reports" },
          { label: "Export CSV", onClick: () => window.print() },
        ]}
        panels={[
          { title: "Dispense Trends", body: "Daily and monthly dispensing analysis." },
          { title: "Controlled Audit", body: "Controlled drug variance and audit trail." },
          { title: "Inventory Reports", body: "Consumption and procurement reports." },
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
          {error ? <div className="muted">{error}</div> : null}
          {loading ? <div className="muted">Loading transfers...</div> : null}
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
            <div className="alert-item">Reconcile transfer-related dispensing in reports.</div>
            <div className="alert-item">Verify controlled log entries for transfer cases.</div>
            <div className="alert-item">Align inventory reports with transfer volume.</div>
          </div>
        </div>
      </section>
    </div>
  );
}
