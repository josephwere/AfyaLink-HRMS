import React, { useEffect, useState } from "react";
import { getGeneralLedger } from "../../services/finance/ledgerApi";

export default function FinanceGeneralLedger() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function loadLedger() {
      try {
        setLoading(true);
        setError("");
        const res = await getGeneralLedger({ limit: 50 });
        const rows = Array.isArray(res?.items) ? res.items : Array.isArray(res?.entries) ? res.entries : [];
        if (mounted) setEntries(rows);
      } catch (err) {
        if (mounted) setError(err?.message || "Unable to load ledger.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadLedger();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="dashboard premium-shell finance-shell">
      <section className="premium-card premium-shell-head">
        <div className="premium-shell-kicker">General Ledger</div>
        <div className="card-header-actions">
          <div>
            <h1 className="premium-shell-title">General Ledger</h1>
            <p className="premium-shell-subtitle">Monitor account-level postings, debit/credit movements, and running balances.</p>
          </div>
        </div>
      </section>

      {error ? <div className="card" style={{ marginTop: 16 }}>{error}</div> : null}

      <section className="section">
        <div className="card">
          <h3>Ledger entries</h3>
          {loading ? <div className="muted">Loading ledger…</div> : (
            <div className="table-wrap">
              <table className="table premium-table">
                <thead><tr><th>Description</th><th>Debit</th><th>Credit</th><th>Status</th></tr></thead>
                <tbody>
                  {entries.length ? entries.map((entry) => (
                    <tr key={entry._id || entry.entryNumber || Math.random()}>
                      <td>{entry.description || entry.entryNumber || "Ledger entry"}</td>
                      <td>{entry.totalDebit || 0}</td>
                      <td>{entry.totalCredit || 0}</td>
                      <td>{entry.status || "POSTED"}</td>
                    </tr>
                  )) : <tr><td colSpan={4}>No ledger entries</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
