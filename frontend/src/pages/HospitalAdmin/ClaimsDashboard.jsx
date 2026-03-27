import { useEffect, useMemo, useState } from "react";
import apiFetch from "../../utils/apiFetch";
import AIAutofillAuditSummary from "../../components/AIAutofillAuditSummary";
import DashboardHomeShell, { DashboardSection } from "../../components/DashboardHomeShell";
import { useAppLanguage } from "../../utils/appLanguage.jsx";

export default function ClaimsDashboard() {
  const { translateText } = useAppLanguage();
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

  const stats = useMemo(() => {
    const rows = Array.isArray(claims) ? claims : [];
    const openAlerts = Array.isArray(alerts) ? alerts : [];
    const highRisk = rows.filter((c) => Number(c?.riskScore || 0) >= 75).length;
    const pending = rows.filter((c) => String(c?.status || "").toUpperCase() === "PENDING").length;
    return {
      openAlerts: openAlerts.length,
      claimsLoaded: rows.length,
      highRisk,
      pending,
    };
  }, [alerts, claims]);

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
    <DashboardHomeShell
      shellKey="revenue_claims"
      kicker={translateText("Revenue")}
      title={translateText("Claims & Fraud Signals")}
      subtitle={translateText("Monitor claim status, flags, and open fraud alerts for your hospital.")}
      actions={[
        { label: translateText("Revenue Intelligence"), path: "/app/revenue/intelligence/index" },
        { label: loading ? translateText("Refreshing...") : translateText("Refresh"), onClick: load, variant: "secondary", disabled: loading },
      ]}
      stats={[
        { label: translateText("Open Alerts"), value: stats.openAlerts, path: "/app/revenue/claims/index#alerts" },
        { label: translateText("Claims Loaded"), value: stats.claimsLoaded, path: "/app/revenue/claims/index#claims" },
        { label: translateText("High Risk"), value: stats.highRisk, path: "/app/revenue/claims/index#claims" },
        { label: translateText("Pending"), value: stats.pending, path: "/app/revenue/claims/index#claims" },
      ]}
    >
      {msg ? <div className="card">{translateText(msg)}</div> : null}

      <AIAutofillAuditSummary
        title={translateText("Claims Autofill Review")}
        subtitle={translateText("Recent AI draft/apply activity for claims and reimbursement workflows in this hospital.")}
        templateIds={["claims"]}
        routeIncludes={["/app/revenue/financials/index", "/app/revenue/claims/index"]}
      />

      <DashboardSection title={translateText("Open Alerts")} subtitle={translateText("Fraud, eligibility, and compliance flags that need action.")}>
        <div className="table-wrap" id="alerts">
          <table className="table premium-table">
            <thead>
              <tr>
                <th>{translateText("Severity")}</th>
                <th>{translateText("Patient")}</th>
                <th>{translateText("Signals")}</th>
                <th>{translateText("Status")}</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert) => (
                <tr key={alert._id}>
                  <td>{translateText(alert.severity)}</td>
                  <td>
                    {alert.patient
                      ? `${alert.patient.firstName} ${alert.patient.lastName}`.trim()
                      : "—"}
                  </td>
                  <td>{Array.isArray(alert.signals) ? alert.signals.join(", ") : "—"}</td>
                  <td>{translateText(alert.status)}</td>
                </tr>
              ))}
              {!alerts.length ? (
                <tr>
                  <td colSpan={4}>{translateText("No open alerts.")}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </DashboardSection>

      <DashboardSection title={translateText("Recent Claims")} subtitle={translateText("Latest claim submissions with risk score and audit access.")}>
        <div className="table-wrap" id="claims">
          <table className="table premium-table">
            <thead>
              <tr>
                <th>{translateText("Patient")}</th>
                <th>{translateText("Provider")}</th>
                <th>{translateText("Total")}</th>
                <th>{translateText("Status")}</th>
                <th>{translateText("Risk Score")}</th>
                <th>{translateText("Audit")}</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((claim) => (
                <tr key={claim._id}>
                  <td>{claim.patient ? `${claim.patient.firstName} ${claim.patient.lastName}`.trim() : "—"}</td>
                  <td>{claim.provider?.code || "—"}</td>
                  <td>{claim.totalAmount || 0}</td>
                  <td>{translateText(claim.status)}</td>
                  <td>{claim.riskScore || 0}</td>
                  <td>
                    <button type="button" className="btn-secondary" onClick={() => openAudit(claim)}>
                      {translateText("Claim Audit")}
                    </button>
                  </td>
                </tr>
              ))}
              {!claims.length ? (
                <tr>
                  <td colSpan={6}>{translateText("No claims submitted yet.")}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </DashboardSection>

      {auditOpen ? (
        <div className="drawer-backdrop" onClick={closeAudit} role="dialog" aria-modal="true">
          <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <h3>{translateText("Claim Audit")}</h3>
                <p className="muted">
                  {auditClaim?.patient ? `${auditClaim.patient.firstName} ${auditClaim.patient.lastName}`.trim() : translateText("Patient")} ·{" "}
                  {auditClaim?.provider?.code || translateText("Provider")}
                </p>
              </div>
              <button type="button" className="btn-secondary" onClick={closeAudit}>
                {translateText("Close")}
              </button>
            </div>

            <div className="drawer-meta">
              <div>
                <strong>{translateText("Status")}</strong>
                <span>{translateText(auditClaim?.status || "—")}</span>
              </div>
              <div>
                <strong>{translateText("Risk Score")}</strong>
                <span>{auditClaim?.riskScore ?? 0}</span>
              </div>
              <div>
                <strong>{translateText("Total")}</strong>
                <span>{auditClaim?.totalAmount ?? 0}</span>
              </div>
            </div>

            {auditLoading ? <div className="card">{translateText("Loading audit trail...")}</div> : null}
            {auditMsg ? <div className="card">{translateText(auditMsg)}</div> : null}

            {!auditLoading && !auditMsg ? (
              <div className="audit-list">
                {auditLogs.map((log) => (
                  <div key={log._id} className="audit-item">
                    <div>
                      <strong>{translateText(log.event)}</strong>
                      <p className="muted">{log.createdAt ? new Date(log.createdAt).toLocaleString() : "—"}</p>
                    </div>
                    <pre>{JSON.stringify(log.payload || {}, null, 2)}</pre>
                  </div>
                ))}
                {!auditLogs.length ? <div className="card">{translateText("No audit events recorded.")}</div> : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </DashboardHomeShell>
  );
}
