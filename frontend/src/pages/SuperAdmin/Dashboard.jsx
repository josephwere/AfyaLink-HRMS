import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { useAuth } from "../../utils/auth";
import apiFetch from "../../utils/apiFetch";
import { triggerAction } from "../../services/actionApi";
import { getSuperAdminDashboard } from "../../services/dashboardApi";
import { getDeveloperOverview } from "../../services/developerApi";
import { listTrainingTrackers } from "../../services/trainingTrackerApi";
import { listTransfers } from "../../services/transferApi";
import DashboardHomeShell, { DashboardSection } from "../../components/DashboardHomeShell";
import { useAppLanguage } from "../../utils/appLanguage.jsx";
import { guardedConsoleFetch } from "../../services/guardedConsoleFetch";

export default function Dashboard() {
  const { user } = useAuth();
  const { translateText } = useAppLanguage();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [ops, setOps] = useState(null);
  const [msg, setMsg] = useState("");
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
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");

  useEffect(() => {
    getSuperAdminDashboard().then(setData).catch(() => setData(null));
    getDeveloperOverview().then(setOps).catch(() => setOps(null));
    guardedConsoleFetch("/api/users?missingRegisteredPharmacy=1&page=1&limit=500", {
      warmupKey: "super-admin-unlinked-pharmacists",
    })
      .then((result) => {
        const res = result?.payload || {};
        const rows = Array.isArray(res?.items) ? res.items : [];
        setUnlinkedPharmacists(rows.length);
      })
      .catch(() => setUnlinkedPharmacists(0));
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
  }, []);

  const pendingTransfers = transfers.filter((t) => t.status === "Pending").length;

  return (
    <DashboardHomeShell
      className="super-admin-dashboard-shell"
      shellKey="super-admin"
      kicker="Founder workspace"
      title="Super Admin Dashboard"
      subtitle="Global control across hospitals, support teams, payroll, security posture, and system direction."
      actions={[
        { label: "Hospitals", path: "/super-admin/hospitals" },
        { label: "Role Management", path: "/admin/create-admin", variant: "secondary" },
        { label: "Super Assistants", path: "/admin/super-assistants", variant: "secondary" },
        { label: "System Settings", path: "/super-admin/settings", variant: "secondary" },
      ]}
      stats={[
        { label: "Hospitals", value: data?.totalHospitals ?? "—", note: "Global footprint" },
        { label: "Total staff", value: data?.totalUsers ?? "—", note: "Cross-role workforce" },
        { label: "Active patients", value: data?.totalPatients ?? "—", note: "Patient network reach" },
        { label: "Pending transfers", value: pendingTransfers, note: "Continuity watch" },
      ]}
      brief={{
        kicker: "Daily brief",
        title: "What needs founder attention now",
        body: "Start with the global health of hospitals, workforce readiness, pharmacy linkage, and cross-facility continuity.",
        items: [
          { label: "Workforce pending", value: ops?.queues?.workforce?.totalPending ?? "—", tone: Number(ops?.queues?.workforce?.totalPending || 0) > 0 ? "warn" : "good" },
          { label: "Unlinked pharmacists", value: unlinkedPharmacists, tone: unlinkedPharmacists > 0 ? "warn" : "good" },
          { label: "Training completion %", value: training.completionRate },
        ],
      }}
      runway={[
        { id: "founder-hospitals", title: "Manage hospitals", description: "Open registry, accreditation, and operational posture across all hospitals.", eyebrow: "Network", path: "/super-admin/hospitals", badge: "Live" },
        { id: "founder-assistants", title: "Super assistant operations", description: "Review the human assistant layer, staffing, and support continuity.", eyebrow: "Operations", path: "/admin/super-assistants", badge: "Team" },
        { id: "founder-payroll", title: "Global payroll", description: "Track cross-hospital finance, payouts, and revenue posture in one workspace.", eyebrow: "Finance", path: "/payments/full", badge: "Money" },
        { id: "founder-settings", title: "System settings", description: "Tune global branding, AI behavior, and compliance-aware product controls.", eyebrow: "Platform", path: "/super-admin/settings", badge: "Control" },
      ]}
      pinnedTools={[
        { id: "founder-pharmacies", title: "Registered pharmacies", description: "Check pharmacy network reach and linkage quality.", eyebrow: "Registry", path: "/super-admin/pharmacies", variant: "compact" },
        { id: "founder-training", title: "Training tracker", description: "See workforce adoption and overdue training signals.", eyebrow: "Adoption", path: "/admin/training-tracker?status=IN_PROGRESS", variant: "compact" },
        { id: "founder-audit", title: "Audit logs", description: "Trace global changes before acting.", eyebrow: "Security", path: "/admin/audit-logs", variant: "compact" },
      ]}
      recentItems={[
        { id: "founder-recent-transfers", title: "Transfer continuity", description: "Return to transfer queues and continuity monitoring.", eyebrow: "Continuity", path: "/system-admin/county-command-center", variant: "compact" },
        { id: "founder-recent-payroll", title: "Payroll overview", description: "Re-open recent payroll and invoice oversight.", eyebrow: "Finance", path: "/payments/full", variant: "compact" },
      ]}
      savedViews={[
        { id: "founder-view-hospital-review", title: "Hospital review queue", description: "Saved entry into verification and approval pressure.", eyebrow: "Saved view", path: "/system-admin/hospital-verification-review", variant: "compact" },
        { id: "founder-view-training-overdue", title: "Training overdue", description: "Focus on overdue learning and readiness bottlenecks.", eyebrow: "Saved view", path: "/admin/training-tracker?status=IN_PROGRESS", variant: "compact" },
      ]}
      contextCards={[
        {
          title: "Founder context",
          subtitle: "Cross-platform signals that matter most at the top level.",
          items: [
            { label: "Payments this month", value: data?.paymentsThisMonth ?? "—" },
            { label: "Invoices", value: data?.invoicesThisMonth ?? "—" },
            { label: "Hospitals with pharmacists", value: data?.hospitalsWithPharmacists ?? "—" },
          ],
          actions: [
            { label: "Open Registered Pharmacies", path: "/super-admin/pharmacies", variant: "secondary" },
            { label: "Open Settings", path: "/super-admin/settings", variant: "secondary" },
          ],
        },
      ]}
    >
      {msg && <div className="card">{msg}</div>}

      <DashboardSection title={translateText("Global Snapshot")} subtitle={translateText("The top-level metrics that define platform reach and network health.")}>
        <div className="grid info-grid">
          <StatCard
            title="Total Hospitals"
            value={data?.totalHospitals ?? "—"}
            onClick={() => navigate("/super-admin/hospitals")}
          />
          <StatCard title="Total Staff" value={data?.totalUsers ?? "—"} onClick={() => navigate("/admin/access-control")} />
          <StatCard title="Active Patients" value={data?.totalPatients ?? "—"} onClick={() => navigate("/system-admin/patient-identity-registry")} />
          <StatCard title="Payroll This Month" value={data?.paymentsThisMonth ?? "—"} onClick={() => navigate("/payments/full")} />
          <StatCard title="Workforce Pending" value={ops?.queues?.workforce?.totalPending ?? "—"} onClick={() => navigate("/developer/queue-replay")} />
          <StatCard title="Workforce Breached" value={ops?.queues?.workforce?.breached ?? "—"} onClick={() => navigate("/developer/queue-replay")} />
          <StatCard title="Total Pharmacists" value={data?.pharmacists ?? "—"} onClick={() => navigate("/super-admin/pharmacies")} />
          <StatCard
            title="Unlinked Pharmacists"
            value={unlinkedPharmacists}
            onClick={() => navigate("/system-admin/pharmacy-access-audit")}
          />
          <StatCard
            title="Training Completion %"
            value={training.completionRate}
            subtitle={`${training.completed}/${training.total} completed`}
            onClick={() => navigate("/admin/training-tracker?status=IN_PROGRESS")}
          />
        </div>
      </DashboardSection>

      <DashboardSection className="doctor-main-grid" title={translateText("Transfer Continuity")} subtitle={translateText("Recent transfers and handoff status.")}>
        <div className="card doctor-schedule-card">
          <div className="card-header-actions">
            <div>
              <h3>{translateText("Transfer Continuity")}</h3>
              <p className="muted">{translateText("Recent transfers and handoff status.")}</p>
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
            <div className="alert-item">{translateText("Review consent gaps before transfer exports.")}</div>
            <div className="alert-item">{translateText("Monitor handover completion for inter-facility transfers.")}</div>
            <div className="alert-item">{translateText("Escalate delays through county command center.")}</div>
          </div>
        </div>
      </DashboardSection>

      <DashboardSection title="Training Tracker" subtitle="Adoption and overdue-readiness pressure across the network.">
        <div className="grid info-grid">
          <StatCard title="Total Trainees" value={training.total} onClick={() => navigate("/admin/training-tracker")} />
          <StatCard title="Not Started" value={training.notStarted} onClick={() => navigate("/admin/training-tracker?status=NOT_STARTED")} />
          <StatCard title="In Progress" value={training.inProgress} onClick={() => navigate("/admin/training-tracker?status=IN_PROGRESS")} />
          <StatCard title="Completed" value={training.completed} onClick={() => navigate("/admin/training-tracker?status=COMPLETED")} />
          <StatCard title="Overdue Not Started" value={training.overdueNotStarted} onClick={() => navigate("/admin/training-tracker?status=NOT_STARTED")} />
          <StatCard title="Overdue In Progress" value={training.overdueInProgress} onClick={() => navigate("/admin/training-tracker?status=IN_PROGRESS")} />
        </div>
      </DashboardSection>

      <DashboardSection className="doctor-main-grid" title="Executive runway" subtitle="Fast action surfaces for finance, audit, security, and operational control.">
        <div className="card doctor-schedule-card">
          <h3>Main Tasks</h3>
          <div className="panel-grid">
            <button
              type="button"
              className="action-link"
              onClick={async () => {
                try {
                  await triggerAction("REVENUE_OVERVIEW");
                  setMsg("");
                } catch (e) {
                  setMsg(e?.message || "Unable to load revenue action right now.");
                } finally {
                  navigate("/payments/full");
                }
              }}
            >
              Revenue Graph
            </button>
            <button type="button" className="action-link" onClick={() => navigate("/analytics")}>Workforce Distribution</button>
            <button type="button" className="action-link" onClick={() => navigate("/reports")}>Compliance Alerts</button>
            <button type="button" className="action-link" onClick={() => navigate("/admin/audit-logs")}>Audit Logs</button>
            <button type="button" className="action-link" onClick={() => navigate("/security-admin")}>Security Incidents</button>
            <button type="button" className="action-link" onClick={() => navigate("/system-admin")}>System Status Monitor</button>
            <button type="button" className="action-link" onClick={() => navigate("/super-admin/pharmacies")}>Pharmacy Registry</button>
            <button type="button" className="action-link" onClick={() => navigate("/system-admin/pharmacy-access-audit")}>Pharmacy Access Audit</button>
            <button type="button" className="action-link" onClick={() => navigate("/admin/training-tracker?role=HOSPITAL_ADMIN&status=NOT_STARTED")}>Training Tracker Board</button>
          </div>
        </div>

        <div className="card doctor-alerts-card">
          <h3>Alerts</h3>
          <div className="alert-stack">
            <div className="action-pill">{translateText("Active Sessions")}: {data?.activeHospitals ?? "—"}</div>
            <div className="action-pill">{translateText("Pending Requests")}: {data?.pendingRequests ?? "—"}</div>
            <div className="action-pill">{translateText("Invoices")}: {data?.invoicesThisMonth ?? "—"}</div>
            <div className="action-pill">{translateText("Hospitals With Pharmacists")}: {data?.hospitalsWithPharmacists ?? "—"}</div>
            <button type="button" className="btn-secondary" onClick={() => navigate("/notifications")}>{translateText("Open Alerts")}</button>
          </div>
        </div>
      </DashboardSection>

      <DashboardSection title={translateText("System Administration")} subtitle={translateText("Cross-platform management tools kept one click away.")}>
        <div className="action-list">
          <button type="button" className="action-link" onClick={() => navigate("/admin/realtime")}>{translateText("Integration Hub")}</button>
          <button type="button" className="action-link" onClick={() => navigate("/admin/crdt-patients")}>{translateText("Offline Sync")}</button>
          <button type="button" className="action-link" onClick={() => navigate("/admin/audit-logs")}>{translateText("Audit Trails")}</button>
          <button type="button" className="action-link" onClick={() => navigate("/reports")}>{translateText("Regulatory Reports")}</button>
        </div>
      </DashboardSection>
    </DashboardHomeShell>
  );
}
