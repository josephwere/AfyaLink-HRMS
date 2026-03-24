import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import {
  getDeveloperOverview,
  getTrustStatus,
  runWorkflowSlaScan,
} from "../../services/developerApi";
import { listTransfers } from "../../services/transferApi";
import { useAppLanguage } from "../../utils/appLanguage.jsx";

const toneToBadge = {
  good: "OK",
  warn: "WATCH",
  risk: "ALERT",
};

export default function DeveloperDashboard() {
  const navigate = useNavigate();
  const { translateText } = useAppLanguage();
  const [data, setData] = useState(null);
  const [trust, setTrust] = useState(null);
  const [runningSla, setRunningSla] = useState(false);
  const [msg, setMsg] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");
  const [lastScan, setLastScan] = useState(null);

  const load = async () => {
    try {
      const [overview, trustStatus] = await Promise.all([
        getDeveloperOverview(),
        getTrustStatus(),
      ]);
      setData(overview || null);
      setTrust(trustStatus?.trust || null);
    } catch {
      setData(null);
      setTrust(null);
    }
    try {
      const res = await listTransfers({ limit: 10, scope: "global" });
      const items = Array.isArray(res?.items) ? res.items : [];
      setTransfers(items);
      setTransferError("");
    } catch (err) {
      setTransfers([]);
      setTransferError(err?.message || "Failed to load transfers.");
    }
  };

  useEffect(() => {
    load();
    try {
      const stored = JSON.parse(localStorage.getItem("workflow_sla_last_scan") || "null");
      setLastScan(stored);
    } catch {
      setLastScan(null);
    }
  }, []);

  const runSla = async () => {
    setRunningSla(true);
    setMsg(null);
    try {
      const result = await runWorkflowSlaScan();
      const l1 = result?.result?.workforce?.escalationsL1 ?? 0;
      const l2 = result?.result?.workforce?.escalationsL2 ?? 0;
      const nextScan = {
        lastScanAt: result?.ranAt || new Date().toISOString(),
        escalationsL1: l1,
        escalationsL2: l2,
        updatedAt: new Date().toISOString(),
      };
      setMsg(`Workflow SLA scan completed (L1: ${l1}, L2: ${l2})`);
      localStorage.setItem("workflow_sla_last_scan", JSON.stringify(nextScan));
      setLastScan(nextScan);
      await load();
    } catch (err) {
      setMsg(err?.message || "Failed to run workflow SLA scan");
    } finally {
      setRunningSla(false);
    }
  };

  const backgroundStatus = useMemo(() => {
    const raw = data?.queues?.background?.byStatus || {};
    return Object.entries(raw)
      .map(([label, value]) => ({ label, value: Number(value || 0) }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [data]);

  const workflowPending = Number(data?.queues?.workforce?.totalPending || 0);
  const queuePressure =
    Number(data?.queues?.dlq?.failed || 0) +
    Number(data?.queues?.webhook?.waiting || 0) +
    Number(data?.queues?.integration?.waiting || 0) +
    Number(data?.queues?.background?.byStatus?.FAILED || 0) +
    Number(data?.queues?.background?.byStatus?.DEAD_LETTER || 0);
  const trustPressure =
    Number(trust?.policyDenials24h || 0) +
    Number(trust?.consentDenials24h || 0) +
    Number(trust?.highRiskStepUps24h || 0);
  const webhookSignals = Array.isArray(data?.webhookLogs) ? data.webhookLogs.slice(0, 6) : [];

  const routingTone = queuePressure > 40 ? "risk" : queuePressure > 10 ? "warn" : "good";
  const trustTone = trustPressure > 40 ? "risk" : trustPressure > 10 ? "warn" : "good";
  const workflowTone = workflowPending > 80 ? "risk" : workflowPending > 20 ? "warn" : "good";

  const formatTime = (value) => {
    if (!value) return translateText("Not configured");
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return translateText("Not configured");
    return date.toLocaleString();
  };

  const topFeatureFlags = useMemo(() => {
    const totals = data?.featureFlags?.totals || {};
    return Object.entries(totals)
      .map(([key, value]) => ({
        key,
        enabled: Number(value?.enabled || 0),
        disabled: Number(value?.disabled || 0),
      }))
      .sort((a, b) => b.enabled - a.enabled)
      .slice(0, 4);
  }, [data]);

  return (
    <div className="dashboard developer-console-page">
      <section className="welcome-panel premium-card developer-console-hero">
        <div className="developer-console-hero-copy">
          <div className="developer-console-kicker">Dev Routing AI</div>
          <h2>Developer Routing AI Console</h2>
          <p className="muted">
            Queue health, trust posture, routing resilience, and developer recovery actions in one premium control plane.
          </p>
          <div className="welcome-actions">
            <button type="button" className="btn-primary" onClick={runSla} disabled={runningSla}>
              {runningSla ? "Running SLA Scan..." : "Run Workflow SLA Scan"}
            </button>
            <button type="button" className="btn-secondary" onClick={load}>
              Refresh Signals
            </button>
            <button type="button" className="btn-secondary" onClick={() => navigate("/developer/decision-cockpit")}>
              Open Decision Cockpit
            </button>
            <button type="button" className="btn-secondary" onClick={() => navigate("/developer/queue-replay")}>
              Open Queue Replay
            </button>
          </div>
        </div>

        <div className="developer-console-hero-meta">
          <div className={`developer-console-pulse ${routingTone}`}>
            <span>{translateText("Queue pulse")}</span>
            <strong>{translateText(toneToBadge[routingTone])}</strong>
            <small>{queuePressure} blocked or waiting signals</small>
          </div>
          <div className={`developer-console-pulse ${trustTone}`}>
            <span>{translateText("Trust posture")}</span>
            <strong>{translateText(toneToBadge[trustTone])}</strong>
            <small>{trustPressure} denials or step-ups in the last 24h</small>
          </div>
          <div className={`developer-console-pulse ${workflowTone}`}>
            <span>{translateText("Workflow pressure")}</span>
            <strong>{translateText(toneToBadge[workflowTone])}</strong>
            <small>{workflowPending} approvals still waiting</small>
          </div>
          <div className="developer-console-pulse neutral">
            <span>{translateText("Last SLA scan")}</span>
            <strong>{lastScan?.lastScanAt ? formatTime(lastScan.lastScanAt) : "Not run yet"}</strong>
            <small>
              {lastScan
                ? `L1 ${lastScan.escalationsL1 || 0} • L2 ${lastScan.escalationsL2 || 0}`
                : "Run once to pin routing risk and workforce breaches."}
            </small>
          </div>
        </div>
      </section>

      {msg && <div className="premium-inline-note">{msg}</div>}

      <section className="section">
        <div className="card-header-actions">
          <div>
            <h3>Routing Pressure</h3>
            <p className="muted">The most important queues and backlogs affecting delivery, retries, and workflow continuity.</p>
          </div>
          <div className="developer-chip-row">
            {backgroundStatus.slice(0, 4).map((item) => (
              <span key={item.label} className="developer-chip">
                {translateText(item.label)}: {item.value}
              </span>
            ))}
          </div>
        </div>
        <div className="grid info-grid">
          <StatCard title="Integration Waiting" value={data?.queues?.integration?.waiting ?? "—"} subtitle="Live pipeline backlog" onClick={() => navigate("/admin/realtime")} />
          <StatCard title="DLQ Failed" value={data?.queues?.dlq?.failed ?? "—"} subtitle="Replay-ready dead letters" status={Number(data?.queues?.dlq?.failed || 0) > 0 ? "risk" : "good"} onClick={() => navigate("/developer/queue-replay")} />
          <StatCard title="Webhook Waiting" value={data?.queues?.webhook?.waiting ?? "—"} subtitle="Inbound connector retries" status={Number(data?.queues?.webhook?.waiting || 0) > 0 ? "warn" : "good"} onClick={() => navigate("/developer/webhook-retry")} />
          <StatCard title="Notification Waiting" value={data?.queues?.notifications?.waiting ?? "—"} subtitle="Outbound delivery backlog" onClick={() => navigate("/admin/realtime")} />
          <StatCard title="Workforce Pending" value={workflowPending ?? "—"} subtitle="Leave, overtime, and shift approvals" status={workflowTone} badge={toneToBadge[workflowTone]} onClick={() => navigate("/developer/decision-cockpit")} />
          <StatCard title="Workforce Breached" value={data?.queues?.workforce?.breached ?? "—"} subtitle="SLA breaches that need routing action" status={Number(data?.queues?.workforce?.breached || 0) > 0 ? "risk" : "good"} onClick={() => navigate("/developer/decision-cockpit")} />
          <StatCard title="Failed Jobs" value={data?.queues?.background?.byStatus?.FAILED ?? 0} subtitle="Retryable durable jobs" status={Number(data?.queues?.background?.byStatus?.FAILED || 0) > 0 ? "warn" : "good"} onClick={() => navigate("/developer/queue-replay")} />
          <StatCard title="Dead-letter Jobs" value={data?.queues?.background?.byStatus?.DEAD_LETTER ?? 0} subtitle="Needs operator replay" status={Number(data?.queues?.background?.byStatus?.DEAD_LETTER || 0) > 0 ? "risk" : "good"} onClick={() => navigate("/developer/queue-replay")} />
        </div>
      </section>

      <section className="section">
        <div className="card-header-actions">
          <div>
            <h3>Trust + Policy Rail</h3>
            <p className="muted">Signals that tell us whether exports, access, consent, and high-risk login flows are behaving safely.</p>
          </div>
          <button type="button" className="btn-secondary" onClick={() => navigate("/developer/provenance-verify")}>
            Open Provenance Verify
          </button>
        </div>
        <div className="grid info-grid">
          <StatCard title="Ledger Writes (24h)" value={trust?.ledgerWrites24h ?? "—"} subtitle="Immutable compliance events" onClick={() => navigate("/developer/provenance-verify")} />
          <StatCard title="Policy Denials (24h)" value={trust?.policyDenials24h ?? "—"} subtitle="ABAC or policy blocks" status={Number(trust?.policyDenials24h || 0) > 0 ? "warn" : "good"} onClick={() => navigate("/developer/decision-cockpit")} />
          <StatCard title="Consent Denials (24h)" value={trust?.consentDenials24h ?? "—"} subtitle="Transfer exports stopped by consent" status={Number(trust?.consentDenials24h || 0) > 0 ? "risk" : "good"} onClick={() => navigate("/developer/provenance-verify")} />
          <StatCard title="Risk Step-Ups (24h)" value={trust?.highRiskStepUps24h ?? "—"} subtitle="Login or access step-up events" status={Number(trust?.highRiskStepUps24h || 0) > 0 ? "warn" : "good"} onClick={() => navigate("/developer/decision-cockpit")} />
          <StatCard title="Active Consents" value={trust?.activeConsents ?? "—"} subtitle="Consent grants currently usable" onClick={() => navigate("/developer/provenance-verify")} />
        </div>
      </section>

      <section className="section developer-console-grid">
        <div className="card premium-card developer-console-table-card">
          <div className="card-header-actions">
            <div>
              <h3>Transfer Continuity Rail</h3>
              <p className="muted">A fast triage view for consent, route integrity, and handover status across inter-facility transfers.</p>
            </div>
            <div className="action-pill">Pending: {transfers.filter((t) => t.status === "Pending").length}</div>
          </div>
          {transferError ? <div className="premium-inline-note">{transferError}</div> : null}
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="doctor-table developer-ops-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Route</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t) => (
                  <tr key={t._id}>
                    <td>{t?.patient?.firstName || ""} {t?.patient?.lastName || ""}</td>
                    <td>{t?.fromHospital?.name || t?.fromHospital?.code || "—"} → {t?.toHospital?.name || t?.toHospital?.code || "—"}</td>
                    <td>
                      <span className="developer-state-badge neutral">{translateText(t.status)}</span>
                    </td>
                  </tr>
                ))}
                {transfers.length === 0 ? (
                  <tr>
                    <td colSpan="3">
                      <div className="developer-empty-state compact">
                        <strong>No transfers waiting.</strong>
                        <p className="muted">When routing risk appears, handover traffic will surface here first.</p>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="developer-inline-actions">
            <button type="button" className="btn-secondary" onClick={() => navigate("/developer/provenance-verify")}>
              Verify Provenance
            </button>
            <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/transfer-command-center")}>
              Open Transfer Command Center
            </button>
          </div>
        </div>

        <div className="developer-console-stack">
          <div className="card premium-card developer-console-sidecard">
            <div className="card-header-actions">
              <div>
                <h3>Recent Webhook Signals</h3>
                <p className="muted">Latest integration webhook events that matter for routing confidence.</p>
              </div>
              <button type="button" className="btn-secondary btn-compact" onClick={() => navigate("/developer/webhook-retry")}>
                Webhook Retry
              </button>
            </div>
            <div className="developer-activity-list">
              {webhookSignals.map((log) => (
                <div key={log._id} className="developer-activity-item">
                  <div>
                    <strong>{log.action || "webhook.event"}</strong>
                    <p className="muted">{formatTime(log.createdAt)}</p>
                  </div>
                  <span className={`developer-state-badge ${String(log.success) === "false" ? "risk" : "good"}`}>
                    {log.success === false ? "FAILED" : "SUCCESS"}
                  </span>
                </div>
              ))}
              {!webhookSignals.length ? (
                <div className="developer-empty-state compact">
                  <strong>No webhook turbulence right now.</strong>
                  <p className="muted">Recent connector events will appear here as they arrive.</p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="card premium-card developer-console-sidecard">
            <div className="card-header-actions">
              <div>
                <h3>Routing Runbooks</h3>
                <p className="muted">Best next actions when queues spike, trust signals drift, or export integrity needs attention.</p>
              </div>
            </div>
            <div className="developer-runbook-list">
              <div className="developer-runbook-item">
                <strong>Queue backlog</strong>
                <p className="muted">Replay dead letters, inspect webhook retries, and clear durable failed jobs before they age into workflow impact.</p>
              </div>
              <div className="developer-runbook-item">
                <strong>Trust signal drift</strong>
                <p className="muted">Review policy denials, consent gaps, and provenance verification before enabling wider export automation.</p>
              </div>
              <div className="developer-runbook-item">
                <strong>Feature readiness</strong>
                <p className="muted">Track which hospital features are enabled so routing decisions stay aligned with live facility capability.</p>
              </div>
            </div>
            <div className="developer-chip-row">
              {topFeatureFlags.map((flag) => (
                <span key={flag.key} className="developer-chip soft">
                  {flag.key}: {flag.enabled}/{flag.enabled + flag.disabled}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="card-header-actions">
          <div>
            <h3>Engineering Tools</h3>
            <p className="muted">Shortcut into the recovery, observability, and AI tooling the routing team uses every day.</p>
          </div>
        </div>
        <div className="developer-tool-grid">
          {[
            ["Webhook Retry", "/developer/webhook-retry", "Retry failed connector deliveries and re-open blocked event paths."],
            ["Job Queue Replay", "/developer/queue-replay", "Inspect DLQ payloads, edit them safely, and replay them back into the pipeline."],
            ["Decision Cockpit", "/developer/decision-cockpit", "Watch anomalies, queue pressure, and policy denials in one focused cockpit."],
            ["Clinical Intelligence", "/system-admin/clinical-intelligence", "Cross-check routing pressure with clinical-system signals."],
            ["Provenance Verify", "/developer/provenance-verify", "Validate signed payload integrity before trusting handoff automation."],
            ["NeuroEdge Extract", "/ai/extract", "Run extraction and evidence workflows when structured payloads need AI help."],
            ["Integration Monitor", "/admin/realtime", "Track connector liveliness, retries, and queue buildup in real time."],
            ["Audit Logs", "/admin/audit-logs", "Trace who changed what before replaying or widening automation."],
            ["Feature Flags", "/super-admin/settings", "Tune rollout posture and AI behavior without leaving the console."],
            ["Workforce Approvals", "/hospital-admin/approvals", "Inspect the real workflow queue that routing pressure eventually affects."],
          ].map(([title, path, body]) => (
            <button key={title} type="button" className="card premium-card developer-tool-card" onClick={() => navigate(path)}>
              <span className="developer-tool-eyebrow">Developer tool</span>
              <strong>{title}</strong>
              <p className="muted">{body}</p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
