import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import apiFetch from "../../utils/apiFetch";

export default function PharmacyDashboard() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);

  useEffect(() => {
    apiFetch("/api/pharmacy?limit=25")
      .then((res) => setItems(Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : []))
      .catch(() => setItems([]));
  }, []);

  const lowStock = items.filter((i) => Number(i?.qty || 0) <= Number(i?.minStock || 0)).length;

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Pharmacy Control Center</h2>
          <p className="muted">Prescription queue, inventory, controlled drugs and expiry monitoring.</p>
        </div>
        <div className="welcome-actions">
          <button className="btn-primary" onClick={() => navigate("/pharmacy")}>Prescription Queue</button>
          <button className="btn-secondary" onClick={() => navigate("/inventory")}>Inventory</button>
          <button className="btn-secondary" onClick={() => navigate("/reports")}>Reports</button>
        </div>
      </div>

      <section className="section">
        <h3>Pharmacy Snapshot</h3>
        <div className="grid info-grid">
          <StatCard title="Pending Prescriptions" value={items.length} />
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
                <tr><th>Drug</th><th>Qty</th><th>Min</th><th>Status</th></tr>
              </thead>
              <tbody>
                {items.slice(0, 10).map((i) => (
                  <tr key={i._id}><td>{i.name || "-"}</td><td>{i.qty ?? "-"}</td><td>{i.minStock ?? "-"}</td><td>{Number(i.qty || 0) <= Number(i.minStock || 0) ? "Low" : "OK"}</td></tr>
                ))}
                {items.length === 0 && <tr><td colSpan="4" className="muted">No inventory data.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card doctor-alerts-card">
          <h3>Interaction Alerts</h3>
          <div className="alert-stack">
            <div className="action-pill">Drug interaction checks active</div>
            <button className="btn-secondary" onClick={() => navigate("/reports")}>Open Safety Reports</button>
          </div>
        </div>
      </section>
    </div>
  );
}
