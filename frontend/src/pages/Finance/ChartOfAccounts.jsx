import React, { useEffect, useState } from "react";
import { listChartOfAccounts } from "../../services/finance/chartOfAccountsApi";

export default function FinanceChartOfAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function loadAccounts() {
      try {
        setLoading(true);
        setError("");
        const res = await listChartOfAccounts({ limit: 200 });
        const rows = Array.isArray(res?.items) ? res.items : Array.isArray(res?.accounts) ? res.accounts : [];
        if (mounted) setAccounts(rows);
      } catch (err) {
        if (mounted) setError(err?.message || "Unable to load chart of accounts.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadAccounts();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="dashboard premium-shell finance-shell">
      <section className="premium-card premium-shell-head">
        <div className="premium-shell-kicker">Chart of accounts</div>
        <div className="card-header-actions">
          <div>
            <h1 className="premium-shell-title">Chart of Accounts</h1>
            <p className="premium-shell-subtitle">Maintain the fiscal account structure and review account categories used across the ledger.</p>
          </div>
        </div>
      </section>

      {error ? <div className="card" style={{ marginTop: 16 }}>{error}</div> : null}

      <section className="section">
        <div className="card">
          <div className="card-header-actions">
            <h3>Account register</h3>
            <button className="btn-primary" type="button">New account</button>
          </div>

          {loading ? <div className="muted">Loading accounts…</div> : (
            <div className="table-wrap">
              <table className="table premium-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Normal balance</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.length ? accounts.map((account) => (
                    <tr key={account._id || account.code}>
                      <td>{account.code}</td>
                      <td>{account.name}</td>
                      <td>{account.category}</td>
                      <td>{account.normalBalance}</td>
                      <td>{account.status || "ACTIVE"}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={5}>No accounts found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
