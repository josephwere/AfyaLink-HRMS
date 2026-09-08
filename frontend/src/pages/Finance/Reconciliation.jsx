import React, { useEffect, useState } from "react";
import { listReconciliationItems } from "../../services/finance/reconciliationApi";

export default function FinanceReconciliation() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function loadReconciliation() {
      try {
        setLoading(true);
        setError("");
        const res = await listReconciliationItems({ limit: 50 });
        const rows = Array.isArray(res?.items) ? res.items : Array.isArray(res?.reconciliation) ? res.reconciliation : [];
        if (mounted) setItems(rows);
      } catch (err) {
        if (mounted) setError(err?.message || "Unable to load reconciliation data.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadReconciliation();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="dashboard premium-shell finance-shell">
      <section className="premium-card premium-shell-head">
        <div className="premium-shell-kicker">Reconciliation</div>
        <div className="card-header-actions">
          <div>
            <h1 className="premium-shell-title">Reconciliation</h1>
            <p className="premium-shell-subtitle">Review unmatched transactions, payment-to-invoice matches, and exceptions requiring attention.</p>
          </div>
        </div>
      </section>

      {error ? <div className="card" style={{ marginTop: 16 }}>{error}</div> : null}

      <section className="section">
        <div className="card">
          <h3>Reconciliation queue</h3>
          {loading ? <div className="muted">Loading reconciliation items…</div> : (
            <div className="table-wrap">
              <table className="table premium-table">
                <thead><tr><th>Type</th><th>Status</th><th>Notes</th></tr></thead>
                <tbody>
                  {items.length ? items.map((item) => (
                    <tr key={item._id || item.type || Math.random()}>
                      <td>{item.type || "ITEM"}</td>
                      <td>{item.status || "PENDING"}</td>
                      <td>{item.message || item.notes || "Awaiting review"}</td>
                    </tr>
                  )) : <tr><td colSpan={3}>No reconciliation items</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
