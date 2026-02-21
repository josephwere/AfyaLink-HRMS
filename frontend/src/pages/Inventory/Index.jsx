import React, { useEffect, useState } from "react";
import { listInventory } from "../../services/inventoryApi";

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
        <button
          className="btn-secondary"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Prev
        </button>
        <span className="muted">
          Page {page} of {totalPages}
        </span>
        <button
          className="btn-secondary"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
        >
          Next
        </button>
      </div>
    </div>
  );
}
