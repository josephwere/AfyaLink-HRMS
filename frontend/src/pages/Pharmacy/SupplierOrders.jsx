import React from "react";
import ModuleWorkspace from "../../components/ModuleWorkspace";
import usePharmacyDashboard from "../../hooks/usePharmacyDashboard";

export default function SupplierOrders() {
  const { transfers, error, loading } = usePharmacyDashboard({ limit: 25 });

  return (
    <div className="dashboard">
      <ModuleWorkspace
        title="Supplier Orders"
        subtitle="Purchase order workflow, supplier lead times and delivery tracking."
        actions={[
          { label: "Create PO", variant: "primary", path: "/pharmacy/suppliers#new" },
          { label: "Track Deliveries", path: "/pharmacy/suppliers#tracking" },
        ]}
        panels={[
          { title: "Open Orders", body: "Purchase orders awaiting fulfillment." },
          { title: "Deliveries", body: "Incoming shipment and receiving logs." },
          { title: "Supplier Performance", body: "Lead-time and reliability metrics." },
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
            <div className="alert-item">Trigger supplier orders for transfer-heavy items.</div>
            <div className="alert-item">Align delivery windows with transfer volume.</div>
            <div className="alert-item">Track supplier delays that affect transfer stock.</div>
          </div>
        </div>
      </section>
    </div>
  );
}
