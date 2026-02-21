import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import {
  getDeveloperOverview,
  getTrustStatus,
  runWorkflowSlaScan,
} from "../../services/developerApi";

export default function DeveloperDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [trust, setTrust] = useState(null);
  const [runningSla, setRunningSla] = useState(false);
  const [msg, setMsg] = useState(null);

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
  };

  useEffect(() => {
    load();
  }, []);

  const runSla = async () => {
    setRunningSla(true);
    setMsg(null);
    try {
      const result = await runWorkflowSlaScan();
      const l1 = result?.result?.workforce?.escalationsL1 ?? 0;
      const l2 = result?.result?.workforce?.escalationsL2 ?? 0;
      setMsg(`Workflow SLA scan completed (L1: ${l1}, L2: ${l2})`);
      localStorage.setItem(
        "workflow_sla_last_scan",
        JSON.stringify({
          lastScanAt: result?.ranAt || new Date().toISOString(),
          escalationsL1: l1,
          escalationsL2: l2,
          updatedAt: new Date().toISOString(),
        })
      );
      await load();
    } catch (err) {
      setMsg(err?.response?.data?.message || "Failed to run workflow SLA scan");
    } finally {
      setRunningSla(false);
    }
  };

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Developer Engineering Console</h2>
          <p className="muted">
            API observability, queue health, trust controls and SLA operations.
          </p>
        </div>
        <div className="welcome-actions">
          <button className="btn-primary" onClick={runSla} disabled={runningSla}>
            {runningSla ? "Running SLA Scan..." : "Run Workflow SLA Scan"}
          </button>
          <button className="btn-secondary" onClick={load}>
            Refresh Metrics
          </button>
          <button className="btn-secondary" onClick={() => navigate("/developer/queue-replay")}>
            Queue Replay
          </button>
          <button className="btn-secondary" onClick={() => navigate("/developer/decision-cockpit")}>
            Decision Cockpit
          </button>
        </div>
      </div>

      {msg && <div className="card">{msg}</div>}

      <section className="section">
        <h3>Queue Metrics</h3>
        <div className="grid info-grid">
          <StatCard title="Integration Waiting" value={data?.queues?.integration?.waiting ?? "—"} />
          <StatCard title="DLQ Failed" value={data?.queues?.dlq?.failed ?? "—"} />
          <StatCard title="Webhook Waiting" value={data?.queues?.webhook?.waiting ?? "—"} />
          <StatCard title="Notification Waiting" value={data?.queues?.notifications?.waiting ?? "—"} />
          <StatCard title="Workforce Pending" value={data?.queues?.workforce?.totalPending ?? "—"} />
          <StatCard title="Workforce Breached" value={data?.queues?.workforce?.breached ?? "—"} />
        </div>
      </section>

      <section className="section">
        <h3>Trust Foundation</h3>
        <div className="grid info-grid">
          <StatCard title="Ledger Writes (24h)" value={trust?.ledgerWrites24h ?? "—"} />
          <StatCard title="Policy Denials (24h)" value={trust?.policyDenials24h ?? "—"} />
          <StatCard title="Consent Denials (24h)" value={trust?.consentDenials24h ?? "—"} />
          <StatCard title="Risk Step-Ups (24h)" value={trust?.highRiskStepUps24h ?? "—"} />
          <StatCard title="Active Consents" value={trust?.activeConsents ?? "—"} />
        </div>
      </section>

      <section className="section">
        <h3>Engineering Tools</h3>
        <div className="panel-grid">
          <button className="action-link" onClick={() => navigate("/developer/webhook-retry")}>
            Webhook Retry
          </button>
          <button className="action-link" onClick={() => navigate("/developer/queue-replay")}>
            Job Queue Replay
          </button>
          <button className="action-link" onClick={() => navigate("/developer/decision-cockpit")}>
            Decision Cockpit
          </button>
          <button className="action-link" onClick={() => navigate("/system-admin/clinical-intelligence")}>
            Clinical Intelligence
          </button>
          <button className="action-link" onClick={() => navigate("/developer/provenance-verify")}>
            Provenance Verify
          </button>
          <button className="action-link" onClick={() => navigate("/ai/extract")}>
            NeuroEdge Extract
          </button>
          <button className="action-link" onClick={() => navigate("/admin/realtime")}>
            Integration Monitor
          </button>
          <button className="action-link" onClick={() => navigate("/admin/audit-logs")}>
            Audit Logs
          </button>
          <button className="action-link" onClick={() => navigate("/super-admin/settings")}>
            Feature Flags
          </button>
          <button className="action-link" onClick={() => navigate("/hospital-admin/approvals")}>
            Workforce Approvals
          </button>
        </div>
      </section>
    </div>
  );
}
