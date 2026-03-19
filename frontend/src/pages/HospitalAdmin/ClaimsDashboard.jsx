import { useEffect, useState } from "react";
import apiFetch from "../../utils/apiFetch";
import AIAutofillAuditSummary from "../../components/AIAutofillAuditSummary";

export default function ClaimsDashboard() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [claims, setClaims] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditClaim, setAuditClaim] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditMsg, setAuditMsg] = useState("");

  const load = async () => {
    setLoading(true);
    setMsg("");
    try {
      const [claimRes, alertRes] = await Promise.all([
        apiFetch("/api/claims?limit=50"),
        apiFetch("/api/claims/alerts?status=OPEN"),
      ]);
      setClaims(Array.isArray(claimRes?.items) ? claimRes.items : []);
      setAlerts(Array.isArray(alertRes?.items) ? alertRes.items : []);
    } catch (err) {
      setMsg(err?.message || "Failed to load claims.");
      setClaims([]);
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

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
          <h2>Claims & Fraud Signals</h2>
          <p className="muted">Monitor claim status, flags, and open fraud alerts for your hospital.</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-secondary" onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {msg ? <div className="card">{msg}</div> : null}

      <AIAutofillAuditSummary
        title="Claims Autofill Review"
        subtitle="Recent AI draft/apply activity for claims and reimbursement workflows in this hospital."
        templateIds={["claims"]}
        routeIncludes={["/hospital-admin/financials", "/hospital-admin/claims"]}
      />

      <section className="section">
        <div className="card premium-card">
          <h3>Open Alerts</h3>
          <div className="table-wrap">
            <table className="table premium-table">
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Patient</th>
                  <th>Signals</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => (
                  <tr key={alert._id}>
                    <td>{alert.severity}</td>
                    <td>{alert.patient ? `${alert.patient.firstName} ${alert.patient.lastName}` : "—"}</td>
                    <td>{Array.isArray(alert.signals) ? alert.signals.join(", ") : "—"}</td>
                    <td>{alert.status}</td>
                  </tr>
                ))}
                {!alerts.length ? (
                  <tr>
                    <td colSpan={4}>No open alerts.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="card premium-card">
          <h3>Recent Claims</h3>
          <div className="table-wrap">
            <table className="table premium-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Provider</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Risk Score</th>
                  <th>Claim Audit</th>
                </tr>
              </thead>
              <tbody>
                {claims.map((claim) => (
                  <tr key={claim._id}>
                    <td>{claim.patient ? `${claim.patient.firstName} ${claim.patient.lastName}` : "—"}</td>
                    <td>{claim.provider?.code || "—"}</td>
                    <td>{claim.totalAmount || 0}</td>
                    <td>{claim.status}</td>
                    <td>{claim.riskScore || 0}</td>
                    <td>
                      <button type="button" className="btn-secondary" onClick={() => openAudit(claim)}>
                        Claim Audit
                      </button>
                    </td>
                  </tr>
                ))}
                {!claims.length ? (
                  <tr>
                    <td colSpan={6}>No claims submitted yet.</td>
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
