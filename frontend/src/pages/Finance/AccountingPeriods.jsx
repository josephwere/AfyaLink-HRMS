import React, { useEffect, useState } from "react";
import { listAccountingPeriods } from "../../services/finance/periodsApi";

export default function FinanceAccountingPeriods() {
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function loadPeriods() {
      try {
        setLoading(true);
        setError("");
        const res = await listAccountingPeriods({ limit: 100 });
        const rows = Array.isArray(res?.items) ? res.items : Array.isArray(res?.periods) ? res.periods : [];
        if (mounted) setPeriods(rows);
      } catch (err) {
        if (mounted) setError(err?.message || "Unable to load accounting periods.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadPeriods();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="dashboard premium-shell finance-shell">
      <section className="premium-card premium-shell-head">
        <div className="premium-shell-kicker">Accounting periods</div>
        <div className="card-header-actions">
          <div>
            <h1 className="premium-shell-title">Accounting Periods</h1>
            <p className="premium-shell-subtitle">Track open and closed accounting periods and enforce posting boundaries.</p>
          </div>
        </div>
      </section>

      {error ? <div className="card" style={{ marginTop: 16 }}>{error}</div> : null}

      <section className="section">
        <div className="card">
          <h3>Period register</h3>
          {loading ? <div className="muted">Loading periods…</div> : (
            <div className="table-wrap">
              <table className="table premium-table">
                <thead><tr><th>Period</th><th>Label</th><th>Status</th></tr></thead>
                <tbody>
                  {periods.length ? periods.map((period) => (
                    <tr key={period._id || period.periodKey}>
                      <td>{period.periodKey}</td>
                      <td>{period.label}</td>
                      <td>{period.status || "OPEN"}</td>
                    </tr>
                  )) : <tr><td colSpan={3}>No periods available</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
