import React, { useEffect, useMemo, useState } from "react";
import { listShifts, approveShift, rejectShift } from "../../services/finance/shiftsApi";

export default function FinanceApprovals() {
  const [pendingShifts, setPendingShifts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("");

  const loadPendingShifts = async () => {
    setLoading(true);
    setError(null);
    try {
      const shifts = await listShifts({ status: "PENDING_APPROVAL", limit: 200 });
      setPendingShifts(Array.isArray(shifts) ? shifts : []);
    } catch (err) {
      setError(err?.message || "Failed to load pending approvals");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendingShifts();
  }, []);

  const visibleShifts = useMemo(() => {
    const q = String(filter || "").trim().toLowerCase();
    if (!q) return pendingShifts;
    return pendingShifts.filter((shift) => {
      const cashier = String(shift.cashierName || shift.cashier || "").toLowerCase();
      const status = String(shift.status || "").toLowerCase();
      const reason = String(shift.reason || "").toLowerCase();
      return cashier.includes(q) || status.includes(q) || reason.includes(q);
    });
  }, [filter, pendingShifts]);

  const handleApprove = async (id) => {
    setActionLoading(id);
    setMessage(null);
    setError(null);
    try {
      await approveShift(id);
      setMessage("Shift approved successfully.");
      await loadPendingShifts();
    } catch (err) {
      setError(err?.message || "Failed to approve shift");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id) => {
    const reason = prompt("Rejection reason") || "Rejected";
    setActionLoading(id);
    setMessage(null);
    setError(null);
    try {
      await rejectShift(id, reason);
      setMessage("Shift rejected successfully.");
      await loadPendingShifts();
    } catch (err) {
      setError(err?.message || "Failed to reject shift");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="dashboard premium-shell finance-shell">
      <section className="premium-card premium-shell-head">
        <div className="premium-shell-kicker">Approvals</div>
        <div className="card-header-actions">
          <div>
            <h1 className="premium-shell-title">Cashier Shift Approvals</h1>
            <p className="premium-shell-subtitle">
              Review and approve cashier shift closure requests before they are finalized.
            </p>
          </div>
          <div>
            <input
              placeholder="Search by cashier, status, or reason"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{ minWidth: 280 }}
            />
            <button type="button" className="btn-secondary" onClick={loadPendingShifts} disabled={loading}>
              Refresh
            </button>
          </div>
        </div>
      </section>

      {(message || error) && (
        <div className="card" style={{ marginTop: 12 }}>
          <strong>{message ? message : "Error"}</strong>
          {error ? <div className="muted">{error}</div> : null}
        </div>
      )}

      <section className="section">
        <div className="card">
          <div className="welcome-actions" style={{ justifyContent: "space-between" }}>
            <div>
              <strong>Pending cashier shift closures</strong>
              <div className="muted">{pendingShifts.length} request{pendingShifts.length === 1 ? "" : "s"} awaiting approval.</div>
            </div>
          </div>

          {loading ? (
            <div className="muted">Loading approvals…</div>
          ) : (
            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table className="table lite">
                <thead>
                  <tr>
                    <th>Cashier</th>
                    <th>Status</th>
                    <th>Opened</th>
                    <th>Expected</th>
                    <th>Actual</th>
                    <th>Variance</th>
                    <th>Reason</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleShifts.length ? (
                    visibleShifts.map((shift) => (
                      <tr key={shift._id || shift.id}>
                        <td>{shift.cashierName || shift.cashier || "Unknown"}</td>
                        <td>{shift.status || "—"}</td>
                        <td>{shift.openedAt ? new Date(shift.openedAt).toLocaleString() : "—"}</td>
                        <td>{shift.expectedTotal ?? "—"}</td>
                        <td>{shift.actualTotal ?? "—"}</td>
                        <td>{shift.variance ?? "—"}</td>
                        <td>{shift.reason || "—"}</td>
                        <td>
                          <button
                            type="button"
                            className="btn-primary"
                            disabled={actionLoading === shift._id}
                            onClick={() => handleApprove(shift._id)}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            disabled={actionLoading === shift._id}
                            onClick={() => handleReject(shift._id)}
                            style={{ marginLeft: 8 }}
                          >
                            Reject
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="muted">
                        {filter ? "No matching shift approvals" : "No pending shift approvals."}
                      </td>
                    </tr>
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
