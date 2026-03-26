import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardHomeShell, { DashboardSection } from "../../components/DashboardHomeShell";
import { useAppLanguage } from "../../utils/appLanguage.jsx";
import {
  getSystemAdminMetrics,
  getRiskPolicy,
  updateRiskPolicy,
  getIntegrationControlPlane,
  getCountyCommandCenterSummary,
} from "../../services/systemAdminApi";
import { getDeveloperOverview, getTrustStatus, runWorkflowSlaScan } from "../../services/developerApi";
import { listTrainingTrackers } from "../../services/trainingTrackerApi";
import { listTransfers } from "../../services/transferApi";
import { guardedConsoleFetch } from "../../services/guardedConsoleFetch";

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

  const [metrics, setMetrics] = useState(null);
  const [devOverview, setDevOverview] = useState(null);
  const [trust, setTrust] = useState(null);
  const [controlPlane, setControlPlane] = useState(null);
  const [county, setCounty] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");

  const [training, setTraining] = useState({
    total: 0,
    notStarted: 0,
    inProgress: 0,
    completed: 0,
    overdueNotStarted: 0,
    overdueInProgress: 0,
    completionRate: 0,
  });

  const [unlinkedPharmacists, setUnlinkedPharmacists] = useState(0);
  const [runningSla, setRunningSla] = useState(false);
  const [msg, setMsg] = useState(null);

  const [riskPolicy, setRiskPolicy] = useState(null);
  const [savingRisk, setSavingRisk] = useState(false);
  const [riskDrawerOpen, setRiskDrawerOpen] = useState(false);

  useEffect(() => {
    Promise.all([getSystemAdminMetrics(), getDeveloperOverview(), getTrustStatus()])
      .then(([m, d, t]) => {
        setMetrics(m || null);
        setDevOverview(d || null);
        setTrust(t?.trust || null);
      })
      .catch(() => {
        setMetrics(null);
        setDevOverview(null);
        setTrust(null);
      });

    getIntegrationControlPlane()
      .then((res) => setControlPlane(res || null))
      .catch(() => setControlPlane(null));

    getCountyCommandCenterSummary()
      .then((res) => setCounty(res || null))
      .catch(() => setCounty(null));

    getRiskPolicy()
      .then((p) => setRiskPolicy(p || null))
      .catch(() => setRiskPolicy(null));

    listTransfers({ limit: 10, scope: "global" })
      .then((res) => {
        const items = Array.isArray(res?.items) ? res.items : [];
        setTransfers(items);
        setTransferError("");
      })
      .catch((err) => {
        setTransfers([]);
        setTransferError(err?.message || "Failed to load transfers.");
      });

    listTrainingTrackers({ limit: 300 })
      .then((res) => {
        const rows = Array.isArray(res?.items) ? res.items : [];
        const now = Date.now();
        const notStarted = rows.filter((r) => r.status === "NOT_STARTED").length;
        const inProgress = rows.filter((r) => r.status === "IN_PROGRESS").length;
        const completed = rows.filter((r) => r.status === "COMPLETED").length;
        const overdueNotStarted = rows.filter(
          (r) =>
            r.status === "NOT_STARTED" &&
            r.createdAt &&
            now - new Date(r.createdAt).getTime() >= 3 * 24 * 60 * 60 * 1000
        ).length;
        const overdueInProgress = rows.filter(
          (r) =>
            r.status === "IN_PROGRESS" &&
            r.updatedAt &&
            now - new Date(r.updatedAt).getTime() >= 7 * 24 * 60 * 60 * 1000
        ).length;
        const total = rows.length;
        const completionRate = total ? Math.round((completed / total) * 100) : 0;
        setTraining({
          total,
          notStarted,
          inProgress,
          completed,
          overdueNotStarted,
          overdueInProgress,
          completionRate,
        });
      })
      .catch(() =>
        setTraining({
          total: 0,
          notStarted: 0,
          inProgress: 0,
          completed: 0,
          overdueNotStarted: 0,
          overdueInProgress: 0,
          completionRate: 0,
        })
      );

    guardedConsoleFetch("/api/users?missingRegisteredPharmacy=1&page=1&limit=500", {
      warmupKey: "system-admin-unlinked-pharmacists",
    })
      .then((result) => {
        const res = result?.payload || {};
        const rows = Array.isArray(res?.items) ? res.items : [];
        setUnlinkedPharmacists(rows.length);
      })
      .catch(() => setUnlinkedPharmacists(0));
  }, []);

  const readyControlModules = useMemo(
    () => controlPlane?.controlPlanes?.filter((row) => row.readiness === "READY").length ?? 0,
    [controlPlane]
  );

  const pendingTransfers = useMemo(
    () => transfers.filter((t) => t.status === "Pending").length,
    [transfers]
  );

  const transferPreview = useMemo(() => transfers.slice(0, 8), [transfers]);

  const closeRiskDrawer = useCallback(() => setRiskDrawerOpen(false), []);

  const openRiskDrawer = useCallback(() => {
    setMsg(null);
    setRiskDrawerOpen(true);
  }, []);

  const runSla = useCallback(async () => {
    setRunningSla(true);
    setMsg(null);
    try {
      const res = await runWorkflowSlaScan();
      const l1 = res?.result?.workforce?.escalationsL1 ?? 0;
      const l2 = res?.result?.workforce?.escalationsL2 ?? 0;
      setMsg(`SLA scan completed (L1: ${l1}, L2: ${l2})`);
      const [m, d, t] = await Promise.all([getSystemAdminMetrics(), getDeveloperOverview(), getTrustStatus()]);
      setMetrics(m || null);
      setDevOverview(d || null);
      setTrust(t?.trust || null);
    } catch (err) {
      setMsg(err?.message || "Failed to run SLA scan");
    } finally {
      setRunningSla(false);
    }
  }, []);

  const saveRiskPolicy = useCallback(async () => {
    if (!riskPolicy) return;
    setSavingRisk(true);
    setMsg(null);
    try {
      const updated = await updateRiskPolicy(riskPolicy);
      setRiskPolicy(updated || riskPolicy);
      setMsg("Adaptive risk policy updated.");
    } catch (err) {
      setMsg(err?.message || "Failed to update risk policy");
    } finally {
      setSavingRisk(false);
    }
  }, [riskPolicy]);

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

