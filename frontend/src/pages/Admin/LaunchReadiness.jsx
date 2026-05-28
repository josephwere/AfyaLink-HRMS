import React, { useEffect, useMemo, useState } from "react";
import apiFetch from "../../utils/apiFetch";

const PHASES = [
  {
    id: "phase0",
    name: "Phase 0 - Baseline",
    objective: "Program readiness assets and baseline security/test gate.",
    checks: ["Readiness assets", "Security gate", "Core tests"],
  },
  {
    id: "phase1",
    name: "Phase 1 - Hardening",
    objective: "Chaos/compliance packs and production preflight posture.",
    checks: ["Chaos drill plan", "Compliance evidence", "Preprod preflight"],
  },
  {
    id: "phase2",
    name: "Phase 2 - Reliability",
    objective: "Integration evidence and failover readiness.",
    checks: ["Connector SLA coverage", "Failover evidence", "Artifact generation"],
  },
  {
    id: "phase3",
    name: "Phase 3 - Pilot",
    objective: "Pilot onboarding/cutover and hypercare KPI tracking.",
    checks: ["Pilot onboarding artifacts", "Cutover runner", "Hypercare snapshots"],
  },
  {
    id: "phase4",
    name: "Phase 4 - Globalization",
    objective: "Country-pack readiness and rollout-wave planning.",
    checks: ["Country packs", "Global readiness verify", "Wave planning"],
  },
  {
    id: "phase5",
    name: "Phase 5 - Launch",
    objective: "Command-center snapshot and launch gate.",
    checks: ["Launch blockers", "Wave execution", "Launch verify"],
  },
  {
    id: "phase6",
    name: "Phase 6 - Executive",
    objective: "Executive report, post-launch 30/60/90 and legal-only gate.",
    checks: ["Executive report", "Post-launch plan", "Legal-only gate"],
  },
];

export default function LaunchReadiness() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [signals, setSignals] = useState({
    backendHealth: null,
    aiGatewayHealth: null,
    systemSettings: null,
    offlineOps: null,
    trainingTracker: null,
  });

  const loadSignals = async () => {
    setLoading(true);
    setErr("");
    try {
      const [backendHealth, aiGatewayHealth, systemSettings, offlineOps, trainingTracker] =
        await Promise.all([
          apiFetch("/health").catch(() => null),
          apiFetch("/api/ai/gateway/health").catch(() => null),
          apiFetch("/api/system-settings").catch(() => null),
          apiFetch("/api/offline/status").catch(() => null),
          apiFetch("/api/training/tracker?limit=1").catch(() => null),
        ]);

      setSignals({
        backendHealth,
        aiGatewayHealth,
        systemSettings,
        offlineOps,
        trainingTracker,
      });
    } catch (e) {
      setErr(String(e?.message || "Failed to load readiness signals"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSignals();
  }, []);

  const readinessScore = useMemo(() => {
    const checks = [
      Boolean(signals.backendHealth?.ok),
      Boolean(signals.aiGatewayHealth?.ok),
      Boolean(signals.systemSettings),
      Boolean(signals.offlineOps),
      Boolean(signals.trainingTracker),
    ];
    const passed = checks.filter(Boolean).length;
    return Math.round((passed / checks.length) * 100);
  }, [signals]);

  const phaseStatus = (phaseId) => {
    switch (phaseId) {
      case "phase0":
        return signals.backendHealth?.ok ? "ready" : "attention";
      case "phase1":
        return signals.systemSettings ? "ready" : "attention";
      case "phase2":
        return signals.offlineOps ? "ready" : "attention";
      case "phase3":
        return signals.trainingTracker ? "ready" : "attention";
      case "phase4":
      case "phase5":
      case "phase6":
        return signals.aiGatewayHealth?.ok ? "ready" : "attention";
      default:
        return "attention";
    }
  };

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Launch Readiness Center</h2>
          <p className="muted">
            Single in-app visibility for phase 0-6 execution so rollout teams can verify technical readiness
            before legal/government execution.
          </p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-secondary" onClick={loadSignals} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh Signals"}
          </button>
        </div>
      </div>

      {err ? (
        <section className="section">
          <div className="card">
            <p className="muted">{err}</p>
          </div>
        </section>
      ) : null}

      <section className="section">
        <div className="grid info-grid">
          <div className="card">
            <h3>Readiness Score</h3>
            <p>{readinessScore}%</p>
          </div>
          <div className="card">
            <h3>System Health</h3>
            <p>{signals.backendHealth?.ok ? "OK" : "Check"}</p>
          </div>
          <div className="card">
            <h3>AI Gateway</h3>
            <p>{signals.aiGatewayHealth?.ok ? "OK" : "Check"}</p>
          </div>
          <div className="card">
            <h3>System Settings</h3>
            <p>{signals.systemSettings ? "Loaded" : "Check"}</p>
          </div>
          <div className="card">
            <h3>Offline Ops</h3>
            <p>{signals.offlineOps ? "Visible" : "Check"}</p>
          </div>
          <div className="card">
            <h3>Training Tracker</h3>
            <p>{signals.trainingTracker ? "Available" : "Check"}</p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="card">
          <h3>Phase Checklist</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Phase</th>
                  <th>Objective</th>
                  <th>Required Checks</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {PHASES.map((phase) => (
                  <tr key={phase.id}>
                    <td>{phase.name}</td>
                    <td>{phase.objective}</td>
                    <td>{phase.checks.join(", ")}</td>
                    <td>{phaseStatus(phase.id) === "ready" ? "Ready" : "Needs Attention"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="card">
          <h3>Launch Rule</h3>
          <p className="muted">
            Proceed only when each phase shows Ready and the rollout stakeholders have signed off on the checklist.
          </p>
        </div>
      </section>
    </div>
  );
}
