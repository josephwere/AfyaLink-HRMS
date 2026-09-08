import React, { useEffect, useMemo, useState } from "react";
import { listShifts } from "../../services/finance/shiftsApi";
import { getGeneralLedger, getJournalEntries } from "../../services/finance/ledgerApi";
import { listAccountingPeriods } from "../../services/finance/periodsApi";
import { listReconciliationItems } from "../../services/finance/reconciliationApi";

const currency = (value) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

export default function FinanceManagerDashboard() {
  const [ledger, setLedger] = useState([]);
  const [journalEntries, setJournalEntries] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [reconciliation, setReconciliation] = useState([]);
  const [pendingShifts, setPendingShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        setLoading(true);
        setError("");

        const [ledgerRes, journalRes, periodRes, reconciliationRes, shiftsRes] = await Promise.all([
          getGeneralLedger({ limit: 5 }),
          getJournalEntries({ limit: 5 }),
          listAccountingPeriods({ limit: 5 }),
          listReconciliationItems({ limit: 5 }),
          listShifts({ status: "UNDER_REVIEW", limit: 5 }),
        ]);

        if (!mounted) return;

        const ledgerItems = Array.isArray(ledgerRes?.items) ? ledgerRes.items : Array.isArray(ledgerRes?.entries) ? ledgerRes.entries : [];
        const journalItems = Array.isArray(journalRes?.items) ? journalRes.items : Array.isArray(journalRes?.entries) ? journalRes.entries : [];
        const periodItems = Array.isArray(periodRes?.items) ? periodRes.items : Array.isArray(periodRes?.periods) ? periodRes.periods : [];
        const reconciliationItems = Array.isArray(reconciliationRes?.items)
          ? reconciliationRes.items
          : Array.isArray(reconciliationRes?.reconciliation)
            ? reconciliationRes.reconciliation
            : [];
        const shiftItems = Array.isArray(shiftsRes) ? shiftsRes : Array.isArray(shiftsRes?.items) ? shiftsRes.items : [];

        setLedger(ledgerItems);
        setJournalEntries(journalItems);
        setPeriods(periodItems);
        setReconciliation(reconciliationItems);
        setPendingShifts(shiftItems);
      } catch (err) {
        if (!mounted) return;
        setError(err?.message || "Unable to load finance manager overview.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();
    return () => { mounted = false; };
  }, []);

  const summary = useMemo(() => {
    const totalLedger = ledger.reduce((sum, entry) => sum + Number(entry.balance ?? entry.totalDebit ?? entry.totalCredit ?? 0), 0);
    const journalTotal = journalEntries.reduce((sum, entry) => sum + Number(entry.totalDebit ?? entry.totalCredit ?? 0), 0);
    const openPeriods = periods.filter((period) => String(period.status || "").toUpperCase() === "OPEN").length;
    const unreconciled = reconciliation.filter((item) => String(item.status || "").toUpperCase() !== "MATCHED").length;
    const pendingApprovalCount = pendingShifts.length;

    return {
      cashPosition: totalLedger,
      totalCollections: journalTotal,
      openPeriods,
      pendingApprovals: pendingApprovalCount,
      reconciliationExceptions: unreconciled,
    };
  }, [ledger, journalEntries, periods, reconciliation, pendingShifts]);

  return (
    <div className="dashboard premium-shell finance-shell">
      <section className="premium-card premium-shell-head">
        <div className="premium-shell-kicker">Management dashboard</div>
        <div className="card-header-actions">
          <div>
            <h1 className="premium-shell-title">Finance Manager Dashboard</h1>
            <p className="premium-shell-subtitle">
              Monitor cash flow, approvals, period health, and reconciliation controls across the hospital finance function.
            </p>
          </div>
        </div>
      </section>

      {error ? <div className="card" style={{ marginTop: 16 }}>{error}</div> : null}

      <section className="section" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <div className="card">
          <div className="premium-shell-kicker">Cash position</div>
          <h3>{loading ? "Loading…" : currency(summary.cashPosition)}</h3>
        </div>
        <div className="card">
          <div className="premium-shell-kicker">Collections</div>
          <h3>{loading ? "Loading…" : currency(summary.totalCollections)}</h3>
        </div>
        <div className="card">
          <div className="premium-shell-kicker">Pending approvals</div>
          <h3>{loading ? "Loading…" : summary.pendingApprovals}</h3>
        </div>
        <div className="card">
          <div className="premium-shell-kicker">Reconciliation exceptions</div>
          <h3>{loading ? "Loading…" : summary.reconciliationExceptions}</h3>
        </div>
      </section>

      <section className="section" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        <div className="card">
          <h3>Open accounting periods</h3>
          <ul>
            {periods.length ? periods.map((period) => (
              <li key={period._id || period.periodKey || Math.random()}>
                {period.label || period.periodKey || "Period"} — {period.status || "OPEN"}
              </li>
            )) : <li>No active accounting periods</li>}
          </ul>
        </div>

        <div className="card">
          <h3>Approval queue</h3>
          <ul>
            {pendingShifts.length ? pendingShifts.map((shift) => (
              <li key={shift._id || shift.id || Math.random()}>
                {shift.cashierName || shift.cashier || "Cashier"} — {shift.status || "UNDER_REVIEW"}
              </li>
            )) : <li>No pending approvals</li>}
          </ul>
        </div>
      </section>

      <section className="section" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        <div className="card">
          <h3>Ledger highlights</h3>
          <table className="table premium-table">
            <thead><tr><th>Description</th><th>Balance</th></tr></thead>
            <tbody>
              {ledger.length ? ledger.map((entry) => (
                <tr key={entry._id || entry.entryNumber || Math.random()}>
                  <td>{entry.description || entry.entryNumber || "Ledger entry"}</td>
                  <td>{currency(entry.balance ?? entry.totalDebit ?? entry.totalCredit ?? 0)}</td>
                </tr>
              )) : <tr><td colSpan={2}>No ledger activity</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Reconciliation status</h3>
          <ul>
            {reconciliation.length ? reconciliation.map((item) => (
              <li key={item._id || item.type || Math.random()}>
                {item.type || "Reconciliation item"} — {item.status || "PENDING"}
              </li>
            )) : <li>No reconciliation items</li>}
          </ul>
        </div>
      </section>
    </div>
  );
}
