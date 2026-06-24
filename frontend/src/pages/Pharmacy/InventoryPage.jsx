import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ModuleWorkspace from "../../components/ModuleWorkspace";
import { listAvailableMedicines } from "../../services/inventoryApi";
import { listTransfers } from "../../services/transferApi";

export default function InventoryPage() {
  const navigate = useNavigate();
  const [medicines, setMedicines] = useState([]);
  const [medicineError, setMedicineError] = useState("");
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");

  useEffect(() => {
    listAvailableMedicines({ limit: 100, includeOutOfStock: true })
      .then((res) => {
        setMedicines(Array.isArray(res?.items) ? res.items : []);
        setMedicineError("");
      })
      .catch((err) => {
        setMedicines([]);
        setMedicineError(err?.message || "Failed to load medicine inventory.");
      });
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
        title="Inventory"
        subtitle="Stock visibility, reorder thresholds and replenishment management."
        actions={[
          { label: "Open Inventory", variant: "primary", onClick: () => navigate("/inventory") },
          { label: "Reorder Planner", path: "/pharmacy/suppliers#planning" },
        ]}
        panels={[
          { title: "Stock Levels", body: "Current quantity by item and category." },
          { title: "Low Stock", body: "Items below configured safety threshold." },
          { title: "Reorder", body: "Supplier reorder planning and execution." },
        ]}
      />

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <div className="card-header-actions">
            <div>
              <h3>Medicines Available To Prescribers</h3>
              <p className="muted">Doctors see this stock list when creating prescriptions.</p>
            </div>
            <div className="action-pill">{medicines.filter((item) => item.stockStatus === "LOW_STOCK").length} low stock</div>
          </div>
          {medicineError ? <div className="muted">{medicineError}</div> : null}
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="doctor-table">
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>SKU</th>
                  <th>Qty</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {medicines.map((item) => (
                  <tr key={item._id}>
                    <td>
                      {item.name}
                      {item.strength ? ` ${item.strength}` : ""}
                      {item.form ? <span className="muted"> • {item.form}</span> : null}
                    </td>
                    <td>{item.sku || "—"}</td>
                    <td>{item.totalQuantity ?? 0} {item.unit || "units"}</td>
                    <td>{item.stockStatus || "AVAILABLE"}</td>
                  </tr>
                ))}
                {medicines.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="muted">No medicines listed yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

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
            <div className="alert-item">Confirm stock levels before transfer dispatch.</div>
            <div className="alert-item">Adjust reorder thresholds for transfer spikes.</div>
            <div className="alert-item">Coordinate supplier restock when transfers surge.</div>
          </div>
        </div>
      </section>
    </div>
  );
}
