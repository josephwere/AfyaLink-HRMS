import React from "react";
import { useNavigate } from "react-router-dom";
import DashboardHomeShell, { DashboardSection } from "../../components/DashboardHomeShell";
import { useAppLanguage } from "../../utils/appLanguage.jsx";
import { useSuperAdminDashboard } from "../../hooks/useSuperAdminDashboard";

export default function Dashboard() {
  const { translateText } = useAppLanguage();
  const navigate = useNavigate();
  const {
    data,
    ops,
    training,
    unlinkedPharmacists,
    transfers,
    transferError,
    pendingTransfers,
  } = useSuperAdminDashboard();

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
        { label: "Hospitals", value: data?.totalHospitals ?? "—", note: "Global footprint", path: "/super-admin/hospitals" },
        { label: "Total staff", value: data?.totalUsers ?? "—", note: "Cross-role workforce", path: "/admin/access-control" },
        { label: "Active patients", value: data?.totalPatients ?? "—", note: "Patient network reach", path: "/system-admin/patient-identity-registry" },
        { label: "Pending transfers", value: pendingTransfers, note: "Continuity watch", path: "/system-admin/county-command-center" },
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
        {
          title: "Ops signals",
          subtitle: "Queues and adoption signals that change what the founder should do next.",
          items: [
            { label: "Active sessions", value: data?.activeHospitals ?? "—" },
            { label: "Pending requests", value: data?.pendingRequests ?? "—", tone: Number(data?.pendingRequests || 0) > 0 ? "warn" : "good" },
            { label: "Workforce pending", value: ops?.queues?.workforce?.totalPending ?? "—", tone: Number(ops?.queues?.workforce?.totalPending || 0) > 0 ? "warn" : "good" },
            { label: "Unlinked pharmacists", value: unlinkedPharmacists, tone: unlinkedPharmacists > 0 ? "warn" : "good" },
            { label: "Training completion %", value: training.completionRate, tone: Number(training.completionRate || 0) < 60 ? "warn" : "good" },
          ],
          actions: [
            { label: "Open Alerts", path: "/notifications", variant: "secondary" },
            { label: "Open Training Tracker", path: "/admin/training-tracker?status=IN_PROGRESS", variant: "secondary" },
          ],
        },
      ]}
    >
      <DashboardSection title={translateText("Transfer Continuity")} subtitle={translateText("Recent transfers and handoff status.")}>
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
      </DashboardSection>
    </DashboardHomeShell>
  );
}
