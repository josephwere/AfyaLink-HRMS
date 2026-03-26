import React, { useEffect, useState } from "react";
import {
  getDeveloperOverview,
  getTrustStatus,
  runWorkflowSlaScan,
} from "../../services/developerApi";
import DashboardHomeShell from "../../components/DashboardHomeShell";
import { useAppLanguage } from "../../utils/appLanguage.jsx";

const toneToBadge = {
  good: "OK",
  warn: "WATCH",
  risk: "ALERT",
};

export default function DeveloperDashboard() {
  const { translateText } = useAppLanguage();
  const [data, setData] = useState(null);
  const [trust, setTrust] = useState(null);
  const [runningSla, setRunningSla] = useState(false);
  const [msg, setMsg] = useState(null);
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

  const routingTone = queuePressure > 40 ? "risk" : queuePressure > 10 ? "warn" : "good";
  const trustTone = trustPressure > 40 ? "risk" : trustPressure > 10 ? "warn" : "good";
  const workflowTone = workflowPending > 80 ? "risk" : workflowPending > 20 ? "warn" : "good";

  const formatTime = (value) => {
    if (!value) return translateText("Not configured");
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return translateText("Not configured");
    return date.toLocaleString();
  };

  return (
    <DashboardHomeShell
      className="developer-console-page"
      shellKey="developer-console"
      kicker="Dev Routing AI"
      title="Developer Routing AI Console"
      subtitle="Queue health, trust posture, routing resilience, and developer recovery actions in one premium control plane."
      actions={[
        { label: runningSla ? "Running SLA Scan..." : "Run Workflow SLA Scan", onClick: runSla, disabled: runningSla },
        { label: "Refresh Signals", onClick: load, variant: "secondary" },
        { label: "Open Decision Cockpit", path: "/developer/decision-cockpit", variant: "secondary" },
        { label: "Open Queue Replay", path: "/developer/queue-replay", variant: "secondary" },
      ]}
      stats={[
        { label: "Queue pulse", value: translateText(toneToBadge[routingTone]), note: `${queuePressure} blocked or waiting signals`, path: "/developer/queue-replay" },
        { label: "Trust posture", value: translateText(toneToBadge[trustTone]), note: `${trustPressure} denials or step-ups`, path: "/developer/decision-cockpit" },
        { label: "Workflow pressure", value: translateText(toneToBadge[workflowTone]), note: `${workflowPending} approvals waiting`, path: "/developer/decision-cockpit" },
        { label: "Last SLA scan", value: lastScan?.lastScanAt ? formatTime(lastScan.lastScanAt) : "Not run yet", note: lastScan ? `L1 ${lastScan.escalationsL1 || 0} • L2 ${lastScan.escalationsL2 || 0}` : "Pin routing risk", path: "/developer/decision-cockpit" },
      ]}
      brief={{
        kicker: "Daily brief",
        title: "What needs routing attention now",
        body: "Use the action runway to jump straight into replay, trust drift, and connector recovery without stacking dashboards on dashboards.",
        items: [
          { label: "Queue pressure", value: queuePressure, tone: routingTone },
          { label: "Trust pressure", value: trustPressure, tone: trustTone },
          { label: "Workflow pending", value: workflowPending, tone: workflowTone },
        ],
      }}
      runway={[
        { id: "dev-queue-replay", title: "Replay queues", description: "Inspect dead letters, failed jobs, and stuck routing payloads before they spill downstream.", eyebrow: "Queues", path: "/developer/queue-replay", badge: "Replay" },
        { id: "dev-webhook-retry", title: "Retry webhooks", description: "Recover connector deliveries and unblock event paths without leaving the console.", eyebrow: "Integrations", path: "/developer/webhook-retry", badge: "Retry" },
        { id: "dev-decision-cockpit", title: "Decision cockpit", description: "Watch anomalies, policy denials, and workload spikes in one focused response cockpit.", eyebrow: "Trust", path: "/developer/decision-cockpit", badge: "Watch" },
        { id: "dev-provenance", title: "Verify provenance", description: "Confirm signed payload integrity before widening automation or export behavior.", eyebrow: "Safety", path: "/developer/provenance-verify", badge: "Verify" },
      ]}
      pinnedTools={[
        { id: "dev-tool-integrations", title: "Integration monitor", description: "Track connectors and live queue buildup in real time.", eyebrow: "Pinned", path: "/admin/realtime", variant: "compact" },
        { id: "dev-tool-audit", title: "Audit logs", description: "Trace actor changes before replaying or widening automation.", eyebrow: "Pinned", path: "/admin/audit-logs", variant: "compact" },
        { id: "dev-tool-flags", title: "Feature flags", description: "Tune rollout posture without leaving the console.", eyebrow: "Pinned", path: "/super-admin/settings", variant: "compact" },
      ]}
      recentItems={[
        { id: "dev-recent-webhooks", title: "Recent webhook signals", description: "Return to inbound connector turbulence fast.", eyebrow: "Recent", path: "/developer/webhook-retry", variant: "compact" },
        { id: "dev-recent-clinical", title: "Clinical intelligence", description: "Cross-check routing pressure against clinical-system signals.", eyebrow: "Recent", path: "/system-admin/clinical-intelligence", variant: "compact" },
      ]}
      savedViews={[
        { id: "dev-view-dlq", title: "Dead-letter jobs", description: "Jump into the failed durable jobs queue directly.", eyebrow: "Saved view", path: "/developer/queue-replay", variant: "compact" },
        { id: "dev-view-trust", title: "Trust drift", description: "Open the trust-heavy decision workflow quickly.", eyebrow: "Saved view", path: "/developer/decision-cockpit", variant: "compact" },
      ]}
      contextCards={[
        {
          title: "AI routing context",
          subtitle: "Trust signals that should stay visible while you replay queues.",
          items: [
            { label: "Policy denials (24h)", value: trust?.policyDenials24h ?? "—", tone: Number(trust?.policyDenials24h || 0) > 0 ? "warn" : "good" },
            { label: "Consent denials (24h)", value: trust?.consentDenials24h ?? "—", tone: Number(trust?.consentDenials24h || 0) > 0 ? "risk" : "good" },
            { label: "Ledger writes (24h)", value: trust?.ledgerWrites24h ?? "—" },
          ],
          actions: [
            { label: "Open Provenance Verify", path: "/developer/provenance-verify", variant: "secondary" },
            { label: "Open Decision Cockpit", path: "/developer/decision-cockpit", variant: "secondary" },
          ],
        },
      ]}
    >
      {msg ? <div className="premium-inline-note">{msg}</div> : null}
    </DashboardHomeShell>
  );
}
