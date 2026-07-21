import { useEffect } from "react";
import useClaimsDashboard from "../../hooks/useClaimsDashboard";

export default function FraudGuard() {
  const {
    loading,
    msg,
    claims,
    alerts,
    summary,
    auditOpen,
    auditClaim,
    auditLogs,
    auditLoading,
    auditMsg,
    reviewingId,
    load,
    openAudit,
    closeAudit,
    reviewClaim,
  } = useClaimsDashboard();

  useEffect(() => {
    void load();
  }, [load]);

  const handleReview = async (claimId, decision) => {
    const confirmText = decision === "APPROVE" ? "Approve this claim?" : "Reject this claim?";
    if (!window.confirm(confirmText)) return;
    const notes = window.prompt("Optional review notes (leave blank if none):", "") || "";
    await reviewClaim(claimId, { decision, notes });
  };

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Fraud Guard</h2>
          <p className="muted">Real-time claim risk monitoring, alert triage, and evidence trails.</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-secondary" onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {msg ? <div className="card">{msg}</div> : null}

      <section className="section">
        <div className="grid info-grid">
          <div className="card premium-card">
            <strong>Total Claims (30d)</strong>
            <p>{summary.totalClaims}</p>
          </div>
          <div className="card premium-card">
            <strong>Review Required</strong>
            <p>{summary.reviewClaims}</p>
          </div>
          <div className="card premium-card">
            <strong>Rejected (30d)</strong>
            <p>{summary.rejectedClaims}</p>
          </div>
          <div className="card premium-card">
            <strong>Open Alerts</strong>
            <p>{summary.openAlerts}</p>
          </div>
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card premium-card">
          <h3>Open Fraud Alerts</h3>
          <div className="table-wrap">
            <table className="table premium-table">
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Hospital</th>
                  <th>Patient</th>
                  <th>Signals</th>
                  <th>Claim Status</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => (
                  <tr key={alert._id}>
                    <td>{alert.severity}</td>
                    <td>{alert.hospital?.name || "—"}</td>
                    <td>{alert.patient ? `${alert.patient.firstName} ${alert.patient.lastName}` : "—"}</td>
                    <td>{Array.isArray(alert.signals) ? alert.signals.join(", ") : "—"}</td>
                    <td>{alert.claim?.status || "—"}</td>
                  </tr>
                ))}
                {!alerts.length ? (
                  <tr>
                    <td colSpan={5}>No open alerts.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card premium-card">
          <h3>Claims Awaiting Review</h3>
          <div className="table-wrap">
            <table className="table premium-table">
              <thead>
                <tr>
                  <th>Hospital</th>
                  <th>Patient</th>
                  <th>Provider</th>
                  <th>Total</th>
                  <th>Risk Score</th>
                  <th>Audit</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {claims.map((claim) => (
                  <tr key={claim._id}>
                    <td>{claim.hospital?.name || "—"}</td>
                    <td>{claim.patient ? `${claim.patient.firstName} ${claim.patient.lastName}` : "—"}</td>
                    <td>{claim.provider?.code || "—"}</td>
                    <td>{claim.totalAmount || 0}</td>
                    <td>{claim.riskScore || 0}</td>
                    <td>
                      <button type="button" className="btn-secondary" onClick={() => openAudit(claim)}>
                        View Audit
                      </button>
                    </td>
                    <td>
                      <div className="profile-actions-row">
                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={reviewingId === claim._id}
                          onClick={() => handleReview(claim._id, "APPROVE")}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="btn-secondary danger"
                          disabled={reviewingId === claim._id}
                          onClick={() => handleReview(claim._id, "REJECT")}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!claims.length ? (
                  <tr>
                    <td colSpan={7}>No claims awaiting review.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {auditOpen ? (
        <div className="drawer-backdrop" onClick={closeAudit} role="dialog" aria-modal="true">
          <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <h3>Claim Audit</h3>
                <p className="muted">
                  {auditClaim?.hospital?.name || "Hospital"} ·{" "}
                  {auditClaim?.patient ? `${auditClaim.patient.firstName} ${auditClaim.patient.lastName}` : "Patient"} ·{" "}
                  {auditClaim?.provider?.code || "Provider"}
                </p>
              </div>
              <button type="button" className="btn-secondary" onClick={closeAudit}>
                Close
              </button>
            </div>

            <div className="drawer-meta">
              <div>
                <strong>Status</strong>
                <span>{auditClaim?.status || "—"}</span>
              </div>
              <div>
                <strong>Risk Score</strong>
                <span>{auditClaim?.riskScore ?? 0}</span>
              </div>
              <div>
                <strong>Total</strong>
                <span>{auditClaim?.totalAmount ?? 0}</span>
              </div>
            </div>

            {auditLoading ? <div className="card">Loading audit trail...</div> : null}
            {auditMsg ? <div className="card">{auditMsg}</div> : null}

            {!auditLoading && !auditMsg ? (
              <div className="audit-list">
                {auditLogs.map((log) => (
                  <div key={log._id} className="audit-item">
                    <div>
                      <strong>{log.event}</strong>
                      <p className="muted">{new Date(log.createdAt).toLocaleString()}</p>
                    </div>
                    <pre>{JSON.stringify(log.payload || {}, null, 2)}</pre>
                  </div>
                ))}
                {!auditLogs.length ? <div className="card">No audit events recorded.</div> : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
