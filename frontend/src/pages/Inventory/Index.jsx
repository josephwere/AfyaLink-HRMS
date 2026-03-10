import React, { useEffect, useState } from "react";
import { listInventory } from "../../services/inventoryApi";
import { listTransfers } from "../../services/transferApi";

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    listInventory({ q, page, limit: 25 })
      .then((res) => {
        if (!active) return;
        setItems(res.items || []);
        setTotal(res.total || 0);
      })
      .catch(() => {
        if (!active) return;
        setError("Failed to load inventory.");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    listTransfers({ limit: 6, scope: "facility" })
      .then((res) => {
        if (!active) return;
        const items = Array.isArray(res?.items) ? res.items : [];
        setTransfers(items);
        setTransferError("");
      })
      .catch((err) => {
        if (!active) return;
        setTransfers([]);
        setTransferError(err?.message || "Failed to load transfers.");
      });
    return () => {
      active = false;
    };
  }, [q, page]);

  const totalPages = Math.max(1, Math.ceil(total / 25));

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Inventory</h2>
          <p className="muted">
            Track stock levels across pharmacy items. Use search to filter.
          </p>
        </div>
        <div className="welcome-actions">
          <input
            className="input"
            placeholder="Search inventory"
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
          />
        </div>
      </div>

      {error && <div className="card">{error}</div>}

      <div className="card">
        {loading ? (
          <div className="muted">Loading inventory...</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Item</th>
                <th>SKU</th>
                <th>Unit</th>
                <th>Total Qty</th>
                <th>Min Stock</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan="5" className="muted">
                    No inventory items yet.
                  </td>
                </tr>
              )}
              {items.map((item) => (
                <tr key={item._id}>
                  <td>{item.name}</td>
                  <td>{item.sku || "—"}</td>
                  <td>{item.unit || "—"}</td>
                  <td>{item.totalQuantity ?? 0}</td>
                  <td>{item.minStock ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="table-footer">
        <button type="button"
          className="btn-secondary"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Prev
        </button>
        <span className="muted">
          Page {page} of {totalPages}
        </span>
        <button type="button"
          className="btn-secondary"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
        >
          Next
        </button>
      </div>

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
            <div className="alert-item">Confirm stock transfers for receiving wards.</div>
            <div className="alert-item">Adjust reorder thresholds for transfer spikes.</div>
            <div className="alert-item">Coordinate supply chain if transfer volume rises.</div>
          </div>
        </div>
      </section>
    </div>
  );
}
