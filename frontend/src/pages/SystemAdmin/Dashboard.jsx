import React from "react";
import { useNavigate } from "react-router-dom";
import DashboardHomeShell, { DashboardSection } from "../../components/DashboardHomeShell";
import { useSystemAdminDashboard } from "../../hooks/useSystemAdminDashboard";
import { useAppLanguage } from "../../utils/appLanguage.jsx";

function clampNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function completionTone(rate) {
  const n = clampNumber(rate, 0);
  if (n >= 90) return "good";
  if (n >= 75) return "warn";
  return "risk";
}

export default function SystemAdminDashboard() {
  const navigate = useNavigate();
  const { translateText } = useAppLanguage();
  const {
    metrics,
    devOverview,
    trust,
    controlPlane,
    county,
    transfers,
    transferError,
    training,
    unlinkedPharmacists,
    runningSla,
    msg,
    setMsg,
    riskPolicy,
    setRiskPolicy,
    savingRisk,
    riskDrawerOpen,
    setRiskDrawerOpen,
    readyControlModules,
    pendingTransfers,
    transferPreview,
    load,
    closeRiskDrawer,
    openRiskDrawer,
    runSla,
    saveRiskPolicy,
    clampNumber,
  } = useSystemAdminDashboard();

  return (
    <>
      <DashboardHomeShell
        className="system-admin-dashboard-shell"
        shellKey="system-admin"
        kicker="National operations"
        title="System Admin Dashboard"
        subtitle="A single command surface for trust pressure, continuity, compliance, and national service health."
        actions={[
          {
            label: runningSla ? "Running SLA Scan..." : "Run Workflow SLA Scan",
            onClick: runSla,
            disabled: runningSla,
          },
          { label: "Compliance Center", path: "/system-admin/compliance-center", variant: "secondary" },
          { label: "Control Plane", path: "/system-admin/integration-control-plane", variant: "secondary" },
        ]}
        stats={[
          {
            label: "Tracked hospitals",
            value: metrics?.hospitals ?? "—",
            note: "Registry",
            path: "/system-admin/government-hospital-registry",
          },
          {
            label: "Ready control modules",
            value: readyControlModules,
            note: "Rollout",
            path: "/system-admin/integration-control-plane",
          },
          {
            label: "Regions at risk",
            value: county?.summary?.regionsAtRisk ?? "—",
            note: "County watch",
            path: "/system-admin/county-command-center",
          },
          {
            label: "Policy denials (24h)",
            value: trust?.policyDenials24h ?? "—",
            note: "Trust pressure",
            path: "/system-admin/compliance-center",
          },
        ]}
        brief={{
          kicker: "Daily brief",
          title: "What needs national action",
          body: "The signals most likely to create incidents if they drift.",
          items: [
            { label: "Pending transfers", value: pendingTransfers, tone: pendingTransfers > 0 ? "warn" : "good" },
            {
              label: "DLQ failed",
              value: devOverview?.queues?.dlq?.failed ?? "—",
              tone: clampNumber(devOverview?.queues?.dlq?.failed, 0) > 0 ? "risk" : "good",
            },
            {
              label: "Unlinked pharmacists",
              value: unlinkedPharmacists,
              tone: unlinkedPharmacists > 0 ? "warn" : "good",
            },
            {
              label: "Training completion %",
              value: training.completionRate,
              tone: completionTone(training.completionRate),
            },
          ],
        }}
        runway={[
          {
            id: "sys-runway-counties",
            title: "County command center",
            description: "Track regions at risk, capacity, and incident pressure by county.",
            eyebrow: "Operations",
            path: "/system-admin/county-command-center",
            badge: `${county?.summary?.regionsAtRisk ?? 0}`,
          },
          {
            id: "sys-runway-control-plane",
            title: "Integration control plane",
            description: "Keep integrations, payments readiness, and rollout posture stable.",
            eyebrow: "Integrations",
            path: "/system-admin/integration-control-plane",
            badge: `${readyControlModules}`,
          },
          {
            id: "sys-runway-compliance",
            title: "Compliance center",
            description: "Review legal holds, policy drift, and governance issues before changes ship.",
            eyebrow: "Compliance",
            path: "/system-admin/compliance-center",
            badge: "Review",
          },
          {
            id: "sys-runway-transfers",
            title: "Transfer continuity watch",
            description: "Monitor pending transfers and national handover bottlenecks.",
            eyebrow: "Continuity",
            path: "/hospital-admin/transfer-command-center",
            badge: `${pendingTransfers}`,
          },
          {
            id: "sys-runway-risk-policy",
            title: "Adaptive risk policy",
            description: "Tune thresholds and restriction windows used by the trust engine.",
            eyebrow: "Trust",
            onClick: openRiskDrawer,
            badge: riskPolicy ? "Edit" : "Missing",
          },
          {
            id: "sys-runway-training",
            title: "Training tracker",
            description: "Follow readiness and overdue learning across system-linked teams.",
            eyebrow: "Adoption",
            path: "/admin/training-tracker?status=IN_PROGRESS",
            badge: `${training.overdueNotStarted + training.overdueInProgress}`,
          },
        ]}
        pinnedTools={[
          {
            id: "sys-tool-registry",
            title: "Gov hospital registry",
            description: "Maintain tracked hospital footprint and verification workflows.",
            eyebrow: "Registry",
            path: "/system-admin/government-hospital-registry",
            variant: "compact",
          },
          {
            id: "sys-tool-abac",
            title: "ABAC policies",
            description: "Manage access policy and permission boundaries for national workspaces.",
            eyebrow: "Security",
            path: "/system-admin/abac",
            variant: "compact",
          },
          {
            id: "sys-tool-mapping",
            title: "Mapping studio",
            description: "Edit mappings used by integrations, imports, and interoperability workflows.",
            eyebrow: "Integrations",
            path: "/system-admin/mapping-studio",
            variant: "compact",
          },
          {
            id: "sys-tool-pharmacy-audit",
            title: "Pharmacy access audit",
            description: "Review unlinked pharmacists and pharmacy access drift.",
            eyebrow: "Audit",
            path: "/system-admin/pharmacy-access-audit",
            variant: "compact",
          },
          {
            id: "sys-tool-developer-console",
            title: "Developer console",
            description: "Queues, logs, replays, and system-level debugging.",
            eyebrow: "Engineering",
            path: "/developer",
            variant: "compact",
          },
          {
            id: "sys-tool-queue-replay",
            title: "Queue replay",
            description: "Re-run failed jobs and reduce DLQ pressure.",
            eyebrow: "Queues",
            path: "/developer/queue-replay",
            variant: "compact",
          },
        ]}
        contextCards={[
          {
            title: "Runtime posture",
            subtitle: "Queues and integrations worth keeping visible.",
            items: [
              { label: "Integration active", value: devOverview?.queues?.integration?.active ?? "—" },
              { label: "Queue waiting", value: devOverview?.queues?.integration?.waiting ?? "—" },
              {
                label: "DLQ failed",
                value: devOverview?.queues?.dlq?.failed ?? "—",
                tone: clampNumber(devOverview?.queues?.dlq?.failed, 0) > 0 ? "risk" : "good",
              },
            ],
            actions: [
              { label: "Open Developer Console", path: "/developer", variant: "secondary" },
              { label: "Open Queue Replay", path: "/developer/queue-replay", variant: "secondary" },
            ],
          },
          {
            title: "National watch",
            subtitle: "Signals that typically trigger escalation.",
            items: [
              {
                label: "Pending transfers",
                value: pendingTransfers,
                tone: pendingTransfers > 0 ? "warn" : "good",
              },
              {
                label: "Training completion %",
                value: training.completionRate,
                tone: completionTone(training.completionRate),
              },
              {
                label: "Unlinked pharmacists",
                value: unlinkedPharmacists,
                tone: unlinkedPharmacists > 0 ? "warn" : "good",
              },
            ],
            actions: [
              { label: "County Command Center", path: "/system-admin/county-command-center", variant: "secondary" },
              { label: "Training Tracker", path: "/admin/training-tracker?status=IN_PROGRESS", variant: "secondary" },
            ],
          },
        ]}
      >
        {msg && !riskDrawerOpen ? <div className="card">{msg}</div> : null}

        <DashboardSection
          className="doctor-main-grid"
          title="Transfer continuity"
          subtitle="Latest transfer volume and pending handovers across the system."
          actions={[
            { label: "County Command Center", path: "/system-admin/county-command-center", variant: "secondary" },
            { label: "Transfer Command Center", path: "/hospital-admin/transfer-command-center", variant: "secondary" },
          ]}
        >
          <div className="card doctor-schedule-card">
            <div className="card-header-actions">
              <div className="action-pill">
                {translateText("Pending")}: {pendingTransfers}
              </div>
            </div>
            {transferError ? <div className="muted">{transferError}</div> : null}
            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table className="doctor-table">
                <thead>
                  <tr>
                    <th>{translateText("Patient")}</th>
                    <th>{translateText("Route")}</th>
                    <th>{translateText("Status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {transferPreview.map((t) => (
                    <tr key={t._id}>
                      <td>
                        {t?.patient
                          ? `${t.patient.firstName || ""} ${t.patient.lastName || ""}`.trim()
                          : "—"}
                      </td>
                      <td>
                        {t?.fromHospital?.name || t?.fromHospital?.code || "—"} {"\u2192"}{" "}
                        {t?.toHospital?.name || t?.toHospital?.code || "—"}
                      </td>
                      <td>{translateText(t.status)}</td>
                    </tr>
                  ))}
                  {transferPreview.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="muted">
                        {translateText("No transfers yet.")}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="doctor-actions-row" style={{ marginTop: 12 }}>
              <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/transfer-command-center")}>
                {translateText("Open transfer command center")}
              </button>
              <button type="button" className="btn-secondary" onClick={() => navigate("/system-admin/county-command-center")}>
                {translateText("Open county command center")}
              </button>
            </div>
          </div>
        </DashboardSection>
      </DashboardHomeShell>

      {riskDrawerOpen ? (
        <div className="drawer-backdrop" onClick={closeRiskDrawer} role="dialog" aria-modal="true">
          <div className="drawer-panel" onClick={(event) => event.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <h3>{translateText("Adaptive risk policy")}</h3>
                <p className="muted">{translateText("Tune thresholds used by trust and safety workflows.")}</p>
              </div>
              <button type="button" className="btn-secondary" onClick={closeRiskDrawer}>
                {translateText("Close")}
              </button>
            </div>

            {msg ? <div className="card">{msg}</div> : null}

            {!riskPolicy ? (
              <div className="card muted">{translateText("Risk policy unavailable.")}</div>
            ) : (
              <>
                <div className="card form">
                  <label>
                    {translateText("High threshold")}
                    <input
                      type="number"
                      value={riskPolicy.thresholds?.high ?? 70}
                      onChange={(e) =>
                        setRiskPolicy((p) => ({
                          ...p,
                          thresholds: { ...(p?.thresholds || {}), high: Number(e.target.value || 70) },
                        }))
                      }
                    />
                  </label>
                  <label>
                    {translateText("Critical threshold")}
                    <input
                      type="number"
                      value={riskPolicy.thresholds?.critical ?? 90}
                      onChange={(e) =>
                        setRiskPolicy((p) => ({
                          ...p,
                          thresholds: { ...(p?.thresholds || {}), critical: Number(e.target.value || 90) },
                        }))
                      }
                    />
                  </label>
                  <label>
                    {translateText("Restriction minutes")}
                    <input
                      type="number"
                      value={riskPolicy.restrictionMinutes ?? 30}
                      onChange={(e) =>
                        setRiskPolicy((p) => ({ ...p, restrictionMinutes: Number(e.target.value || 30) }))
                      }
                    />
                  </label>
                  <label>
                    {translateText("Impossible travel window (min)")}
                    <input
                      type="number"
                      value={riskPolicy.impossibleTravelWindowMinutes ?? 90}
                      onChange={(e) =>
                        setRiskPolicy((p) => ({
                          ...p,
                          impossibleTravelWindowMinutes: Number(e.target.value || 90),
                        }))
                      }
                    />
                  </label>
                </div>
                <div className="welcome-actions mt-12">
                  <button type="button" className="btn-primary" onClick={saveRiskPolicy} disabled={savingRisk}>
                    {savingRisk ? translateText("Saving...") : translateText("Save risk policy")}
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => navigate("/step-up")}>
                    {translateText("Step-up console")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

