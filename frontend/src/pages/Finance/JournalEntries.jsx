import React, { useEffect, useState } from "react";
import { getJournalEntries } from "../../services/finance/ledgerApi";

export default function FinanceJournalEntries() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function loadJournals() {
      try {
        setLoading(true);
        setError("");
        const res = await getJournalEntries({ limit: 50 });
        const rows = Array.isArray(res?.items) ? res.items : Array.isArray(res?.entries) ? res.entries : [];
        if (mounted) setEntries(rows);
      } catch (err) {
        if (mounted) setError(err?.message || "Unable to load journal entries.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadJournals();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="dashboard premium-shell finance-shell">
      <section className="premium-card premium-shell-head">
        <div className="premium-shell-kicker">Journal Entries</div>
        <div className="card-header-actions">
          <div>
            <h1 className="premium-shell-title">Journal Entries</h1>
            <p className="premium-shell-subtitle">Review posted entries, debit/credit balances, and journal status for current accounting periods.</p>
          </div>
        </div>
      </section>

      {error ? <div className="card" style={{ marginTop: 16 }}>{error}</div> : null}

      <section className="section">
        <div className="card">
          <h3>Journal register</h3>
          {loading ? <div className="muted">Loading journals…</div> : (
            <div className="table-wrap">
              <table className="table premium-table">
                <thead><tr><th>Entry</th><th>Description</th><th>Debit</th><th>Credit</th><th>Status</th></tr></thead>
                <tbody>
                  {entries.length ? entries.map((entry) => (
                    <tr key={entry._id || entry.entryNumber || Math.random()}>
                      <td>{entry.entryNumber || entry._id}</td>
                      <td>{entry.description || "Journal entry"}</td>
                      <td>{entry.totalDebit || 0}</td>
                      <td>{entry.totalCredit || 0}</td>
                      <td>{entry.status || "POSTED"}</td>
                    </tr>
                  )) : <tr><td colSpan={5}>No journal entries</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
