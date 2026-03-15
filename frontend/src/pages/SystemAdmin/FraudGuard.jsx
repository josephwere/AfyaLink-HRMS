import { useEffect, useState } from "react";
import apiFetch from "../../utils/apiFetch";

export default function FraudGuard() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [summary, setSummary] = useState({ totalClaims: 0, reviewClaims: 0, rejectedClaims: 0, openAlerts: 0 });
  const [alerts, setAlerts] = useState([]);
  const [claims, setClaims] = useState([]);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditClaim, setAuditClaim] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditMsg, setAuditMsg] = useState("");
  const [reviewingId, setReviewingId] = useState("");

  const load = async () => {
    setLoading(true);
    setMsg("");
    try {
      const [summaryRes, alertRes, claimRes] = await Promise.all([
        apiFetch("/api/claims/summary"),
        apiFetch("/api/claims/alerts?status=OPEN"),
        apiFetch("/api/claims?status=REVIEW_REQUIRED&limit=25"),
      ]);
      setSummary(summaryRes?.totals || { totalClaims: 0, reviewClaims: 0, rejectedClaims: 0, openAlerts: 0 });
      setAlerts(Array.isArray(alertRes?.items) ? alertRes.items : []);
      setClaims(Array.isArray(claimRes?.items) ? claimRes.items : []);
    } catch (err) {
      setMsg(err?.message || "Failed to load fraud guard data.");
      setSummary({ totalClaims: 0, reviewClaims: 0, rejectedClaims: 0, openAlerts: 0 });
      setAlerts([]);
      setClaims([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const reviewClaim = async (claimId, decision) => {
    if (!claimId) return;
    const confirmText = decision === "APPROVE" ? "Approve this claim?" : "Reject this claim?";
    if (!window.confirm(confirmText)) return;
    const notes = window.prompt("Optional review notes (leave blank if none):", "") || "";
    setReviewingId(claimId);
    setMsg("");
    try {
      await apiFetch(`/api/claims/${claimId}/review`, {
        method: "POST",
        body: { decision, notes },
      });
      await load();
    } catch (err) {
      setMsg(err?.message || "Failed to review claim.");
    } finally {
      setReviewingId("");
    }
  };

  const openAudit = async (claim) => {
    if (!claim?._id) return;
    setAuditOpen(true);
    setAuditClaim(claim);
    setAuditLogs([]);
    setAuditMsg("");
    setAuditLoading(true);
    try {
      const res = await apiFetch(`/api/claims/${claim._id}/audit`);
      setAuditLogs(Array.isArray(res?.items) ? res.items : []);
    } catch (err) {
      setAuditMsg(err?.message || "Failed to load claim audit.");
    } finally {
      setAuditLoading(false);
    }
  };

  const closeAudit = () => {
    setAuditOpen(false);
    setAuditClaim(null);
    setAuditLogs([]);
    setAuditMsg("");
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
                          onClick={() => reviewClaim(claim._id, "APPROVE")}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="btn-secondary danger"
                          disabled={reviewingId === claim._id}
                          onClick={() => reviewClaim(claim._id, "REJECT")}
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
