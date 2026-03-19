import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import {
  getDeveloperOverview,
  getTrustStatus,
  runWorkflowSlaScan,
} from "../../services/developerApi";
import { listTransfers } from "../../services/transferApi";

export default function DeveloperDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [trust, setTrust] = useState(null);
  const [runningSla, setRunningSla] = useState(false);
  const [msg, setMsg] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");

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
      setMsg(err?.message || "Failed to run workflow SLA scan");
    } finally {
      setRunningSla(false);
    }
  };

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Developer Dashboard</h2>
          <p className="muted">
            Simple developer view for queue health, trust checks, and tools.
          </p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-primary" onClick={runSla} disabled={runningSla}>
            {runningSla ? "Running SLA Scan..." : "Run Workflow SLA Scan"}
          </button>
          <button type="button" className="btn-secondary" onClick={load}>
            Refresh Metrics
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/developer/queue-replay")}>
            Queue Replay
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/developer/decision-cockpit")}>
            Decision Cockpit
          </button>
        </div>
      </div>

      {msg && <div className="card">{msg}</div>}

      <section className="section">
        <h3>Queue Metrics</h3>
        <div className="grid info-grid">
          <StatCard title="Integration Waiting" value={data?.queues?.integration?.waiting ?? "—"} onClick={() => navigate("/admin/realtime")} />
          <StatCard title="DLQ Failed" value={data?.queues?.dlq?.failed ?? "—"} onClick={() => navigate("/developer/queue-replay")} />
          <StatCard title="Webhook Waiting" value={data?.queues?.webhook?.waiting ?? "—"} onClick={() => navigate("/developer/webhook-retry")} />
          <StatCard title="Notification Waiting" value={data?.queues?.notifications?.waiting ?? "—"} onClick={() => navigate("/admin/realtime")} />
          <StatCard title="Workforce Pending" value={data?.queues?.workforce?.totalPending ?? "—"} onClick={() => navigate("/developer/decision-cockpit")} />
          <StatCard title="Workforce Breached" value={data?.queues?.workforce?.breached ?? "—"} onClick={() => navigate("/developer/decision-cockpit")} />
        </div>
      </section>

      <section className="section">
        <h3>Trust Foundation</h3>
        <div className="grid info-grid">
          <StatCard title="Ledger Writes (24h)" value={trust?.ledgerWrites24h ?? "—"} onClick={() => navigate("/developer/provenance-verify")} />
          <StatCard title="Policy Denials (24h)" value={trust?.policyDenials24h ?? "—"} onClick={() => navigate("/developer/decision-cockpit")} />
          <StatCard title="Consent Denials (24h)" value={trust?.consentDenials24h ?? "—"} onClick={() => navigate("/developer/provenance-verify")} />
          <StatCard title="Risk Step-Ups (24h)" value={trust?.highRiskStepUps24h ?? "—"} onClick={() => navigate("/developer/decision-cockpit")} />
          <StatCard title="Active Consents" value={trust?.activeConsents ?? "—"} onClick={() => navigate("/developer/provenance-verify")} />
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <div className="card-header-actions">
            <div>
              <h3>Transfer Continuity</h3>
              <p className="muted">Verify handover, consent, and provenance signals.</p>
            </div>
            <div className="action-pill">Pending: {transfers.filter((t) => t.status === "Pending").length}</div>
          </div>
          {transferError ? <div className="muted">{transferError}</div> : null}
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="doctor-table">
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
                    <td>{t.status}</td>
                  </tr>
                ))}
                {transfers.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="muted">No transfers yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="doctor-actions-row" style={{ marginTop: 12 }}>
            <button type="button" className="btn-secondary" onClick={() => navigate("/developer/provenance-verify")}>
              Provenance Verify
            </button>
            <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/transfer-command-center")}>
              Transfer Command Center
            </button>
          </div>
        </div>
        <div className="card doctor-alerts-card">
          <h3>Continuity Actions</h3>
          <div className="alert-stack">
            <div className="alert-item">Investigate consent denials for transfer exports.</div>
            <div className="alert-item">Validate provenance signatures after HL7/FHIR export.</div>
            <div className="alert-item">Surface 24h pending transfers to county command center.</div>
          </div>
        </div>
      </section>

      <section className="section">
        <h3>Engineering Tools</h3>
        <div className="panel-grid">
          <button type="button" className="action-link" onClick={() => navigate("/developer/webhook-retry")}>
            Webhook Retry
          </button>
          <button type="button" className="action-link" onClick={() => navigate("/developer/queue-replay")}>
            Job Queue Replay
          </button>
          <button type="button" className="action-link" onClick={() => navigate("/developer/decision-cockpit")}>
            Decision Cockpit
          </button>
          <button type="button" className="action-link" onClick={() => navigate("/system-admin/clinical-intelligence")}>
            Clinical Intelligence
          </button>
          <button type="button" className="action-link" onClick={() => navigate("/developer/provenance-verify")}>
            Provenance Verify
          </button>
          <button type="button" className="action-link" onClick={() => navigate("/ai/extract")}>
            NeuroEdge Extract
          </button>
          <button type="button" className="action-link" onClick={() => navigate("/admin/realtime")}>
            Integration Monitor
          </button>
          <button type="button" className="action-link" onClick={() => navigate("/admin/audit-logs")}>
            Audit Logs
          </button>
          <button type="button" className="action-link" onClick={() => navigate("/super-admin/settings")}>
            Feature Flags
          </button>
          <button type="button" className="action-link" onClick={() => navigate("/hospital-admin/approvals")}>
            Workforce Approvals
          </button>
        </div>
      </section>
    </div>
  );
}
