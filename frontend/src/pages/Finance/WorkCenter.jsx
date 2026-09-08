import React, { useEffect, useState } from "react";
import { getWorkCenter } from "../../services/finance/workCenterApi";
import { approveShift, rejectShift } from "../../services/finance/shiftsApi";

export default function WorkCenter() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getWorkCenter()
      .then((res) => setData(res))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="muted">Loading Work Center…</div>;
  if (!data) return <div>No data available.</div>;

  return (
    <div className="finance-work-center">
      <h2>Finance Work Center</h2>

      <section>
        <h3>Approval Queue</h3>
        <ul>
          <li>Pending shift approvals ({data.approvalQueue.shiftApprovals})</li>
          <li>Pending refunds ({data.approvalQueue.refundApprovals})</li>
          <li>Pending journal approvals ({data.approvalQueue.journalApprovals})</li>
          <li>Pending consolidation runs ({data.approvalQueue.consolidationApprovals})</li>
        </ul>

        <div style={{ marginTop: 12 }}>
          <h4>Pending Shifts</h4>
          {data.workItems && data.workItems.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Shift</th>
                  <th>Cashier</th>
                  <th>Submitted</th>
                  <th>Variance</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.workItems.map((w) => {
                  const s = w.metadata.shiftId ? { _id: w.metadata.shiftId, cashierName: w.metadata.cashierName, submittedAt: w.createdAt, variance: w.metadata.variance } : null;
                  return (
                    <tr key={w._id}>
                      <td>{w.type}</td>
                      <td>{s ? s.cashierName || w.metadata.cashier : (w.assignedTo || '—')}</td>
                      <td>{new Date(w.createdAt).toLocaleString()}</td>
                      <td>{s ? s.variance : '—'}</td>
                      <td>
                        <button
                          className="btn-sm"
                          onClick={async () => {
                            try {
                              await fetch(`/api/workflow/items/${w._id}/action`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'approve' }) });
                              alert('Approved');
                              const refreshed = await getWorkCenter();
                              setData(refreshed);
                            } catch (e) {
                              alert(e?.message || String(e));
                            }
                          }}
                        >
                          Approve
                        </button>
                        <button
                          className="btn-sm btn-danger"
                          onClick={async () => {
                            const reason = prompt('Rejection reason') || 'Rejected';
                            try {
                              await fetch(`/api/workflow/items/${w._id}/action`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reject', payload: { reason } }) });
                              alert('Rejected');
                              const refreshed = await getWorkCenter();
                              setData(refreshed);
                            } catch (e) {
                              alert(e?.message || String(e));
                            }
                          }}
                        >
                          Reject
                        </button>
                        <button className="btn-sm" onClick={() => window.location.href = w.actionUrl || '/app/finance/approvals'}>
                          Open
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="muted">No pending shifts</div>
          )}
        </div>
      </section>

      <section>
        <h3>Notifications</h3>
        <ul>
          {data.notifications.map((n) => (
            <li key={n._id} style={{ fontWeight: n.read ? "normal" : "bold" }}>{n.title} — {new Date(n.createdAt).toLocaleString()}</li>
          ))}
        </ul>
      </section>

      <section>
        <h3>Tasks</h3>
        <ul>
          {data.tasks.map((t) => (
            <li key={t.key}>{t.label}</li>
          ))}
        </ul>
      </section>

      <section>
        <h3>Today's KPIs</h3>
        <ul>
          <li>Revenue: {data.kpis.revenueToday}</li>
          <li>Outstanding Bills: {data.kpis.outstandingBills}</li>
          <li>Collections: {data.kpis.collectionsToday}</li>
          <li>Refunds: {data.kpis.refundsToday}</li>
          <li>Cash Variance (avg): {data.kpis.cashVariance.avgVariance}</li>
          <li>Pending Claims: {data.kpis.pendingClaims}</li>
        </ul>
      </section>
    </div>
  );
}
