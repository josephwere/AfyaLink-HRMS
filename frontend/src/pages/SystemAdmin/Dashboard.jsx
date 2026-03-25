import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import apiFetch from "../../utils/apiFetch";
import {
  getSystemAdminMetrics,
  getRiskPolicy,
  updateRiskPolicy,
  getIntegrationControlPlane,
  getCountyCommandCenterSummary,
} from "../../services/systemAdminApi";
import { getDeveloperOverview, getTrustStatus, runWorkflowSlaScan } from "../../services/developerApi";
import { runStaffingForecast, runDigitalTwin } from "../../services/mlApi";
import { listTrainingTrackers } from "../../services/trainingTrackerApi";
import { listTransfers } from "../../services/transferApi";
import DashboardHomeShell, { DashboardSection } from "../../components/DashboardHomeShell";
import { useAppLanguage } from "../../utils/appLanguage.jsx";
import { guardedConsoleFetch } from "../../services/guardedConsoleFetch";

export default function SystemAdminDashboard() {
  const navigate = useNavigate();
  const { translateText } = useAppLanguage();
  const [metrics, setMetrics] = useState(null);
  const [devOverview, setDevOverview] = useState(null);
  const [trust, setTrust] = useState(null);
  const [runningSla, setRunningSla] = useState(false);
  const [msg, setMsg] = useState(null);
  const [riskPolicy, setRiskPolicy] = useState(null);
  const [savingRisk, setSavingRisk] = useState(false);
  const [ai, setAi] = useState(null);
  const [training, setTraining] = useState({
    total: 0,
    notStarted: 0,
    inProgress: 0,
    completed: 0,
    overdueNotStarted: 0,
    overdueInProgress: 0,
    completionRate: 0,
  });
  const [aiTrend, setAiTrend] = useState({
    doctorGap: [],
    nurseGap: [],
    underCapacity: [],
    pendingShifts: [],
    trainingCompletion: [],
  });
  const [unlinkedPharmacists, setUnlinkedPharmacists] = useState(0);
  const [controlPlane, setControlPlane] = useState(null);
  const [county, setCounty] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");

  const appendTrend = (key, value) => {
    setAiTrend((prev) => ({
      ...prev,
      [key]: [...(prev[key] || []), Number(value || 0)].slice(-12),
    }));
  };

  const gapStatus = (v) => {
    const n = Number(v || 0);
    if (n <= 0) return "good";
    if (n <= 5) return "warn";
    return "risk";
  };

  const countStatus = (v, warn = 1, risk = 3) => {
    const n = Number(v || 0);
    if (n >= risk) return "risk";
    if (n >= warn) return "warn";
    return "good";
  };

  const badgeFromStatus = (s) => (s === "risk" ? "ALERT" : s === "warn" ? "WATCH" : "OK");

  const loadAi = async () => {
    try {
      const [forecast, twin] = await Promise.all([
        runStaffingForecast({
          beds: 300,
          occupancyRate: 0.8,
          avgPatientsPerDoctor: 14,
          avgPatientsPerNurse: 5,
          horizonDays: 14,
        }),
        runDigitalTwin({
          departments: [
            { name: "ICU", staff: 22, demand: 28, absenteeismRate: 0.06 },
            { name: "Emergency", staff: 36, demand: 41, absenteeismRate: 0.05 },
            { name: "Surgery", staff: 18, demand: 17, absenteeismRate: 0.04 },
          ],
        }),
      ]);
      setAi({ forecast, twin });
      const underCapacity = Array.isArray(twin?.twin?.departments)
        ? twin.twin.departments.filter((d) => d.status === "UNDER_CAPACITY").length
        : 0;
      appendTrend("doctorGap", forecast?.forecast?.doctorGap || 0);
      appendTrend("nurseGap", forecast?.forecast?.nurseGap || 0);
      appendTrend("underCapacity", underCapacity);
      appendTrend("pendingShifts", twin?.twin?.pendingRequests?.shifts || 0);
    } catch {
      setAi(null);
    }
  };

  useEffect(() => {
    Promise.all([
      getSystemAdminMetrics(),
      getDeveloperOverview(),
      getTrustStatus(),
    ])
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
    getRiskPolicy()
      .then((p) => setRiskPolicy(p || null))
      .catch(() => setRiskPolicy(null));
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
        appendTrend("trainingCompletion", completionRate);
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
    loadAi();
    guardedConsoleFetch("/api/users?missingRegisteredPharmacy=1&page=1&limit=500", {
      warmupKey: "system-admin-unlinked-pharmacists",
    })
      .then((result) => {
        const res = result?.payload || {};
        const rows = Array.isArray(res?.items) ? res.items : [];
        setUnlinkedPharmacists(rows.length);
      })
      .catch(() => setUnlinkedPharmacists(0));
    getIntegrationControlPlane()
      .then((res) => setControlPlane(res || null))
      .catch(() => setControlPlane(null));
    getCountyCommandCenterSummary()
      .then((res) => setCounty(res || null))
      .catch(() => setCounty(null));
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
    const timer = setInterval(loadAi, 45000);
    return () => clearInterval(timer);
  }, []);

  const runSla = async () => {
    setRunningSla(true);
    setMsg(null);
    try {
      const res = await runWorkflowSlaScan();
      const l1 = res?.result?.workforce?.escalationsL1 ?? 0;
      const l2 = res?.result?.workforce?.escalationsL2 ?? 0;
      setMsg(`SLA scan completed (L1: ${l1}, L2: ${l2})`);
      const [m, d, t] = await Promise.all([
        getSystemAdminMetrics(),
        getDeveloperOverview(),
        getTrustStatus(),
      ]);
      setMetrics(m || null);
      setDevOverview(d || null);
      setTrust(t?.trust || null);
    } catch (err) {
      setMsg(err?.message || "Failed to run SLA scan");
    } finally {
      setRunningSla(false);
    }
  };

  const saveRiskPolicy = async () => {
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
  };

  const readyControlModules =
    controlPlane?.controlPlanes?.filter((row) => row.readiness === "READY").length ?? 0;
  const pendingTransfers = transfers.filter((t) => t.status === "Pending").length;

  return (
    <DashboardHomeShell
      className="system-admin-dashboard-shell"
      kicker="National operations"
      title="System Admin Dashboard"
      subtitle="Technical command across queues, integrations, compliance pressure, and national service health."
      actions={[
        {
          label: runningSla ? "Running SLA Scan..." : "Run Workflow SLA Scan",
          onClick: runSla,
          disabled: runningSla,
        },
        { label: "Gov Hospital Registry", path: "/system-admin/government-hospital-registry", variant: "secondary" },
        { label: "Control Plane", path: "/system-admin/integration-control-plane", variant: "secondary" },
        { label: "County Command", path: "/system-admin/county-command-center", variant: "secondary" },
        { label: "Compliance Center", path: "/system-admin/compliance-center", variant: "secondary" },
      ]}
      stats={[
        { label: "Tracked hospitals", value: metrics?.hospitals ?? "—", note: "National footprint" },
        { label: "Ready control modules", value: readyControlModules, note: "Operational rollout" },
        { label: "Regions at risk", value: county?.summary?.regionsAtRisk ?? "—", note: "County watchlist" },
        { label: "Policy denials (24h)", value: trust?.policyDenials24h ?? "—", note: "Decision pressure" },
      ]}
      contextCards={[
        {
          title: "Runtime posture",
          subtitle: "Keep queues, control planes, and trust pressure in view.",
          items: [
            { label: "Integration active", value: devOverview?.queues?.integration?.active ?? "—" },
            { label: "Queue waiting", value: devOverview?.queues?.integration?.waiting ?? "—" },
            { label: "DLQ failed", value: devOverview?.queues?.dlq?.failed ?? "—", tone: Number(devOverview?.queues?.dlq?.failed || 0) > 0 ? "risk" : "good" },
          ],
          actions: [
            { label: "Open Developer Console", path: "/developer", variant: "secondary" },
            { label: "Open Queue Replay", path: "/developer/queue-replay", variant: "secondary" },
          ],
        },
        {
          title: "National watch",
          subtitle: "Operational signals worth a system-level response.",
          items: [
            { label: "Pending transfers", value: pendingTransfers, tone: pendingTransfers > 0 ? "warn" : "good" },
            { label: "Training completion %", value: training.completionRate },
            { label: "Unlinked pharmacists", value: unlinkedPharmacists, tone: unlinkedPharmacists > 0 ? "warn" : "good" },
          ],
          actions: [
            { label: "County Command Center", path: "/system-admin/county-command-center", variant: "secondary" },
            { label: "Training Tracker", path: "/admin/training-tracker?status=IN_PROGRESS", variant: "secondary" },
          ],
        },
      ]}
    >

      {msg && <div className="card">{msg}</div>}

      <DashboardSection title={translateText("System Widgets")} subtitle={translateText("Fast operational readouts across the national control surface.")}>
        <div className="grid info-grid">
          <StatCard title="CPU / Memory" value={devOverview?.queues?.integration?.active ?? "—"} onClick={() => navigate("/developer")} />
          <StatCard title="Req / Min" value={devOverview?.queues?.integration?.completed ?? "—"} onClick={() => navigate("/admin/realtime")} />
          <StatCard title="Failed Logins" value={metrics?.approvals?.total ?? "—"} onClick={() => navigate("/admin/audit-logs?q=login")} />
          <StatCard title="Job Status" value={devOverview?.queues?.integration?.waiting ?? "—"} onClick={() => navigate("/developer/queue-replay")} />
          <StatCard
            title="Total Hospitals"
            value={metrics?.hospitals ?? "—"}
            onClick={() => navigate("/super-admin/hospitals")}
          />
          <StatCard title="Database Health" value={devOverview?.queues?.dlq?.failed ?? "—"} onClick={() => navigate("/developer")} />
          <StatCard title="Workforce Breached" value={devOverview?.queues?.workforce?.breached ?? "—"} onClick={() => navigate("/developer/queue-replay")} />
          <StatCard title="Policy Denials (24h)" value={trust?.policyDenials24h ?? "—"} onClick={() => navigate("/developer/decision-cockpit")} />
          <StatCard
            title="Unlinked Pharmacists"
            value={unlinkedPharmacists}
            onClick={() => navigate("/system-admin/pharmacy-access-audit")}
          />
          <StatCard
            title="Training Completion %"
            value={training.completionRate}
            trend={aiTrend.trainingCompletion}
            subtitle={`${training.completed}/${training.total} completed`}
            onClick={() => navigate("/admin/training-tracker?status=IN_PROGRESS")}
          />
          <StatCard
            title="Ready Control Modules"
            value={controlPlane?.controlPlanes?.filter((row) => row.readiness === "READY").length ?? "—"}
            subtitle={`${controlPlane?.summary?.paymentEnabledHospitals ?? 0} hospitals with payments`}
            onClick={() => navigate("/system-admin/integration-control-plane")}
          />
          <StatCard
            title="Regions At Risk"
            value={county?.summary?.regionsAtRisk ?? "—"}
            subtitle={`${county?.summary?.totalRegions ?? 0} regions tracked`}
            onClick={() => navigate("/system-admin/county-command-center")}
          />
        </div>
      </DashboardSection>

      <DashboardSection
        className="doctor-main-grid"
        title={translateText("Transfer Continuity")}
        subtitle={translateText("National overview of transfer volume and pending handovers.")}
        actions={[
          { label: "County Command Center", path: "/system-admin/county-command-center", variant: "secondary" },
          { label: "Transfer Command Center", path: "/hospital-admin/transfer-command-center", variant: "secondary" },
        ]}
      >
        <div className="card doctor-schedule-card">
          <div className="card-header-actions">
            <div>
              <h3>{translateText("Transfer Continuity")}</h3>
              <p className="muted">{translateText("National overview of transfer volume and pending handovers.")}</p>
            </div>
            <div className="action-pill">{translateText("Pending")}: {transfers.filter((t) => t.status === "Pending").length}</div>
          </div>
          {transferError ? <div className="muted">{translateText(transferError)}</div> : null}
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
                {transfers.map((t) => (
                  <tr key={t._id}>
                    <td>{t?.patient?.firstName || ""} {t?.patient?.lastName || ""}</td>
                    <td>{t?.fromHospital?.name || t?.fromHospital?.code || "—"} → {t?.toHospital?.name || t?.toHospital?.code || "—"}</td>
                    <td>{translateText(t.status)}</td>
                  </tr>
                ))}
                {transfers.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="muted">{translateText("No transfers yet.")}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="doctor-actions-row" style={{ marginTop: 12 }}>
            <button type="button" className="btn-secondary" onClick={() => navigate("/system-admin/county-command-center")}>
              {translateText("County Command Center")}
            </button>
            <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/transfer-command-center")}>
              {translateText("Transfer Command Center")}
            </button>
          </div>
        </div>
        <div className="card doctor-alerts-card">
          <h3>{translateText("Continuity Actions")}</h3>
          <div className="alert-stack">
            <div className="alert-item">{translateText("Track pending transfers over 24h per county.")}</div>
            <div className="alert-item">{translateText("Verify consent and handover completion for escalations.")}</div>
            <div className="alert-item">{translateText("Review transfer bottlenecks in county command center.")}</div>
          </div>
        </div>
      </DashboardSection>

      <DashboardSection title={translateText("Training Tracker")} subtitle={translateText("Adoption and operational readiness across system-linked teams.")}>
        <div className="grid info-grid">
          <StatCard title="Total Trainees" value={training.total} onClick={() => navigate("/admin/training-tracker")} />
          <StatCard title="Not Started" value={training.notStarted} onClick={() => navigate("/admin/training-tracker?status=NOT_STARTED")} />
          <StatCard title="In Progress" value={training.inProgress} onClick={() => navigate("/admin/training-tracker?status=IN_PROGRESS")} />
          <StatCard title="Completed" value={training.completed} onClick={() => navigate("/admin/training-tracker?status=COMPLETED")} />
          <StatCard title="Overdue Not Started" value={training.overdueNotStarted} onClick={() => navigate("/admin/training-tracker?status=NOT_STARTED")} />
          <StatCard title="Overdue In Progress" value={training.overdueInProgress} onClick={() => navigate("/admin/training-tracker?status=IN_PROGRESS")} />
        </div>
      </DashboardSection>

      <DashboardSection title="Technical Operations" subtitle="Primary national tools for integrations, audit, rollout, and AI oversight.">
        <div className="panel-grid">
          <button type="button" className="action-link" onClick={() => navigate("/developer")}>Error Logs</button>
          <button type="button" className="action-link" onClick={() => navigate("/developer")}>API Logs</button>
          <button type="button" className="action-link" onClick={() => navigate("/developer/queue-replay")}>Queue Monitor</button>
          <button type="button" className="action-link" onClick={() => navigate("/developer/webhook-retry")}>Webhook Retry</button>
          <button type="button" className="action-link" onClick={() => navigate("/system-admin/abac")}>ABAC Policies</button>
          <button type="button" className="action-link" onClick={() => navigate("/system-admin/mapping-studio")}>Mapping Studio</button>
          <button type="button" className="action-link" onClick={() => navigate("/system-admin/pharmacy-access-audit")}>Pharmacy Access Audit</button>
          <button type="button" className="action-link" onClick={() => navigate("/system-admin/integration-hub")}>Gov Integration Hub</button>
          <button type="button" className="action-link" onClick={() => navigate("/system-admin/integration-control-plane")}>Integration Control Plane</button>
          <button type="button" className="action-link" onClick={() => navigate("/system-admin/county-command-center")}>County Command Center</button>
          <button type="button" className="action-link" onClick={() => navigate("/system-admin/connector-sdk")}>Connector SDK</button>
          <button type="button" className="action-link" onClick={() => navigate("/system-admin/nlp-analytics")}>NLP Analytics</button>
          <button type="button" className="action-link" onClick={() => navigate("/system-admin/clinical-intelligence")}>Clinical Intelligence</button>
          <button type="button" className="action-link" onClick={() => navigate("/system-admin/regulatory-reports")}>Regulatory Reports</button>
          <button type="button" className="action-link" onClick={() => navigate("/developer/ai-extraction-history")}>AI Extraction History</button>
          <button type="button" className="action-link" onClick={() => navigate("/super-admin/settings")}>Feature Flags</button>
          <button type="button" className="action-link" onClick={() => navigate("/admin/realtime")}>Integration Hub</button>
          <button type="button" className="action-link" onClick={() => navigate("/admin/training-tracker?role=COMMUNITY_HEALTH_WORKER&status=IN_PROGRESS")}>Training Tracker Board</button>
        </div>
      </DashboardSection>

      <section className="section">
        <h3>AI Intelligence Snapshot</h3>
        <div className="grid info-grid">
          <StatCard
            title="Doctor Gap"
            value={ai?.forecast?.forecast?.doctorGap ?? "—"}
            trend={aiTrend.doctorGap}
            subtitle="Auto-refresh 45s"
            status={gapStatus(ai?.forecast?.forecast?.doctorGap)}
            badge={badgeFromStatus(gapStatus(ai?.forecast?.forecast?.doctorGap))}
            why={`Gap is ${ai?.forecast?.forecast?.doctorGap ?? 0}; >5 means critical staffing risk.`}
            onClick={() => navigate("/hospital-admin/register-staff?role=doctor")}
            onBadgeClick={() => navigate("/hospital-admin/register-staff?role=doctor")}
          />
          <StatCard
            title="Nurse Gap"
            value={ai?.forecast?.forecast?.nurseGap ?? "—"}
            trend={aiTrend.nurseGap}
            subtitle="Auto-refresh 45s"
            status={gapStatus(ai?.forecast?.forecast?.nurseGap)}
            badge={badgeFromStatus(gapStatus(ai?.forecast?.forecast?.nurseGap))}
            why={`Gap is ${ai?.forecast?.forecast?.nurseGap ?? 0}; >5 means critical staffing risk.`}
            onClick={() => navigate("/hospital-admin/register-staff?role=nurse")}
            onBadgeClick={() => navigate("/hospital-admin/register-staff?role=nurse")}
          />
          <StatCard
            title="Under-Capacity Units"
            value={
              Array.isArray(ai?.twin?.twin?.departments)
                ? ai.twin.twin.departments.filter((d) => d.status === "UNDER_CAPACITY").length
                : "—"
            }
            trend={aiTrend.underCapacity}
            subtitle="Auto-refresh 45s"
            status={countStatus(
              Array.isArray(ai?.twin?.twin?.departments)
                ? ai.twin.twin.departments.filter((d) => d.status === "UNDER_CAPACITY").length
                : 0,
              1,
              2
            )}
            badge={badgeFromStatus(
              countStatus(
                Array.isArray(ai?.twin?.twin?.departments)
                  ? ai.twin.twin.departments.filter((d) => d.status === "UNDER_CAPACITY").length
                  : 0,
                1,
                2
              )
            )}
            why={`Units with unmet demand are flagged. 2+ under-capacity units are critical.`}
            onClick={() => navigate("/system-admin/clinical-intelligence#digital-twin")}
            onBadgeClick={() => navigate("/system-admin/clinical-intelligence#digital-twin")}
          />
          <StatCard
            title="Twin Pending Shifts"
            value={ai?.twin?.twin?.pendingRequests?.shifts ?? "—"}
            trend={aiTrend.pendingShifts}
            subtitle="Auto-refresh 45s"
            status={countStatus(ai?.twin?.twin?.pendingRequests?.shifts, 5, 15)}
            badge={badgeFromStatus(countStatus(ai?.twin?.twin?.pendingRequests?.shifts, 5, 15))}
            why={`Pending shift requests above 15 indicate strong scheduling pressure.`}
            onClick={() => navigate("/hospital-admin/approvals?kind=SHIFT&view=all")}
            onBadgeClick={() => navigate("/hospital-admin/approvals?kind=SHIFT&view=all")}
          />
        </div>
      </section>

      <section className="section">
        <h3>Adaptive Risk Policy</h3>
        <div className="card">
          {!riskPolicy ? (
            <p className="muted">Risk policy unavailable.</p>
          ) : (
            <>
              <div className="grid info-grid">
                <label className="muted">
                  High Threshold
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
                <label className="muted">
                  Critical Threshold
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
                <label className="muted">
                  Restriction Minutes
                  <input
                    type="number"
                    value={riskPolicy.restrictionMinutes ?? 30}
                    onChange={(e) =>
                      setRiskPolicy((p) => ({ ...p, restrictionMinutes: Number(e.target.value || 30) }))
                    }
                  />
                </label>
                <label className="muted">
                  Impossible Travel Window (min)
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
                  {savingRisk ? "Saving..." : "Save Risk Policy"}
                </button>
                <button type="button" className="btn-secondary" onClick={() => navigate("/step-up")}>
                  Step-up Console
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="section">
        <h3>Admin Controls</h3>
        <div className="action-list">
          <button type="button" className="action-link" onClick={() => navigate("/super-admin/hospitals")}>Hospitals</button>
          <button type="button" className="action-link" onClick={() => navigate("/admin/create-admin")}>Role Overrides</button>
          <button type="button" className="action-link" onClick={() => navigate("/admin/super-assistants")}>Super Assistants</button>
          <button type="button" className="action-link" onClick={() => navigate("/admin/audit-logs")}>Audit Logs</button>
          <button type="button" className="action-link" onClick={() => navigate("/notifications")}>Alerts</button>
        </div>
      </section>
    </DashboardHomeShell>
  );
}
