import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getShift, approveShift, rejectShift } from "../../services/finance/shiftsApi";

export default function ShiftApproval() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [shift, setShift] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getShift(id)
      .then((s) => setShift(s))
      .catch((e) => setError(e?.message || String(e)))
      .finally(() => setLoading(false));
  }, [id]);

  const handleApprove = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      await approveShift(id);
      alert("Shift approved");
      navigate("/app/finance/approvals/index");
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!id) return;
    const reason = prompt("Rejection reason") || "Rejected";
    setActionLoading(true);
    try {
      await rejectShift(id, reason);
      alert("Shift rejected");
      navigate("/app/finance/approvals/index");
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div className="muted">Loading shift…</div>;
  if (!shift) return <div className="muted">No shift found.</div>;

  return (
    <div className="dashboard premium-shell finance-shell">
      <section className="premium-card premium-shell-head">
        <div className="premium-shell-kicker">Shift Approval</div>
        <div className="card-header-actions">
          <div>
            <h1 className="premium-shell-title">Shift {String(shift._id).slice(-6)}</h1>
            <p className="premium-shell-subtitle">Review details before approving or rejecting.</p>
          </div>
          <div>
            <button className="btn-secondary" onClick={() => navigate(-1)}>Back</button>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="card">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <strong>Cashier</strong>
              <div className="muted">{shift.cashierName || shift.cashier}</div>
              <strong style={{ marginTop: 8 }}>Opening float</strong>
              <div>{shift.openingFloat ?? "—"}</div>
              <strong style={{ marginTop: 8 }}>Expected</strong>
              <div>{shift.expectedTotal ?? "—"}</div>
            </div>
            <div>
              <strong>Actual counted</strong>
              <div>{shift.actualTotal ?? "—"}</div>
              <strong style={{ marginTop: 8 }}>Variance</strong>
              <div>{shift.variance ?? "—"}</div>
              <strong style={{ marginTop: 8 }}>Reason</strong>
              <div>{shift.reason || "—"}</div>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <strong>Counts / Breakdown</strong>
            <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(shift.counts || {}, null, 2)}</pre>
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button className="btn-primary" disabled={actionLoading} onClick={handleApprove}>Approve Shift</button>
            <button className="btn-danger" disabled={actionLoading} onClick={handleReject}>Reject Shift</button>
            <button className="btn-secondary" onClick={() => alert('View receipts - TODO')}>View Receipts</button>
            <button className="btn-secondary" onClick={() => alert('View payments - TODO')}>View Payments</button>
          </div>
          {error ? <div className="muted" style={{ marginTop: 8 }}>{error}</div> : null}
        </div>
      </section>
    </div>
  );
}
