import React from "react";
import { useNavigate } from "react-router-dom";
import HospitalAdminCommandCenterShell, { DashboardSection } from "./CommandCenterShell";
import { useAppLanguage } from "../../utils/appLanguage.jsx";
import { ExecutiveCommandCenter } from "../../components/ExecutiveWidgets";
import useHospitalAdminDashboard from "../../hooks/useHospitalAdminDashboard";

function clampNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function gapTone(value) {
  const n = clampNumber(value, 0);
  if (n <= 0) return "good";
  if (n <= 3) return "warn";
  return "risk";
}

function completionTone(rate) {
  const n = clampNumber(rate, 0);
  if (n >= 90) return "good";
  if (n >= 75) return "warn";
  return "risk";
}

export default function Dashboard() {
  const { translateText } = useAppLanguage();
  const navigate = useNavigate();
  const {
    data,
    executiveData,
    forecast,
    machineStats,
    trainingStats,
    transfers,
    transferError,
    pendingTransfers,
    overdueLearning,
    machineAlerts,
    pharmacyRiskStatus,
    pharmacyRiskTone,
    staffRiskCount,
    wardOccupancyRows,
    executiveWidgetData,
  } = useHospitalAdminDashboard();

  return (
    <HospitalAdminCommandCenterShell
      className="hospital-admin-dashboard-shell"
      shellKey="hospital-admin"
      kicker="Hospital command center"
      title="Hospital Admin Control Center"
      subtitle="Operational domains, workflow entry points, and executive pulse for the hospital."
      actions={[
        { label: "Staff Directory", path: "/hospital-admin/staff" },
        { label: "Approvals", path: "/hospital-admin/approvals", variant: "secondary" },
        { label: "Transfer Command", path: "/hospital-admin/transfer-command-center", variant: "secondary" },
      ]}
      stats={[
        { label: "Staff count", value: data?.totalStaff ?? "—", note: "Facility workforce", path: "/hospital-admin/staff" },
        {
          label: "Bed occupancy",
          value: `${data?.bedOccupancyRate ?? "—"}%`,
          note: `${data?.occupiedBeds ?? 0}/${data?.totalBeds ?? 0} occupied`,
          path: "/hospital-admin/ward-board",
        },
        { label: "Pending approvals", value: data?.pendingRequests ?? "—", note: "Needs admin action", path: "/hospital-admin/approvals" },
        { label: "Active consultations", value: data?.activeConsultationCalls ?? "—", note: "Care coordination", path: "/hospital-admin/consultation-monitor" },
      ]}
      brief={{
        kicker: "Executive pulse",
        title: "What needs attention first",
        body: "The command center aligns facility operations, staffing, pharmacy, and finance around the highest-risk workflows.",
        items: [
          {
            label: "Pending approvals",
            value: data?.pendingRequests ?? 0,
            tone: clampNumber(data?.pendingRequests, 0) > 0 ? "warn" : "good",
          },
          {
            label: "Transfer backlog",
            value: pendingTransfers,
            tone: pendingTransfers > 0 ? "warn" : "good",
          },
          {
            label: "Pharmacy risk",
            value: pharmacyRiskStatus,
            tone: pharmacyRiskTone,
          },
          {
            label: "Offline devices",
            value: machineStats.offline,
            tone: machineStats.offline > 0 ? "warn" : "good",
          },
        ],
      }}
      runway={[
        {
          id: "hospital-runway-approvals",
          title: "Clear pending approvals",
          description: "Handle the requests slowing staffing, access, and operational flow.",
          eyebrow: "Approvals",
          path: "/hospital-admin/approvals",
          badge: `${data?.pendingRequests ?? 0}`,
        },
        {
          id: "hospital-runway-ward",
          title: "Resolve bed capacity pressure",
          description: "Open ward and bed flow operations before occupancy spikes.",
          eyebrow: "Capacity",
          path: "/hospital-admin/ward-board",
          badge: `${data?.totalBeds ? `${data?.occupiedBeds ?? 0}/${data?.totalBeds ?? 0}` : "—"}`,
        },
        {
          id: "hospital-runway-consults",
          title: "Consultation monitor",
          description: "Re-open call handling, escalation visibility, and bedside coordination.",
          eyebrow: "Clinical ops",
          path: "/hospital-admin/consultation-monitor",
          badge: `${data?.activeConsultationCalls ?? 0}`,
        },
        {
          id: "hospital-runway-transfers",
          title: "Transfer continuity",
          description: "Track pending handovers and prevent transfer delays.",
          eyebrow: "Continuity",
          path: "/hospital-admin/transfer-command-center",
          badge: `${pendingTransfers}`,
        },
        {
          id: "hospital-runway-machines",
          title: "Machine alerts",
          description: "Keep device uptime, offline stations, and integration drift visible.",
          eyebrow: "Devices",
          path: "/hospital-admin/machine-alerts",
          badge: `${machineAlerts}`,
        },
        {
          id: "hospital-runway-training",
          title: "Training tracker",
          description: "Resolve overdue learning and readiness gaps before audits.",
          eyebrow: "Adoption",
          path: "/admin/training-tracker?status=IN_PROGRESS",
          badge: `${overdueLearning}`,
        },
      ]}
      pinnedTools={[
        {
          id: "hospital-tool-ward",
          title: "Ward board",
          description: "Switch into bed-side flow and ward operations.",
          eyebrow: "Flow",
          path: "/hospital-admin/ward-board",
          variant: "compact",
        },
        {
          id: "hospital-tool-staff",
          title: "Staff directory",
          description: "Jump into the workforce roster and staffing controls.",
          eyebrow: "People",
          path: "/hospital-admin/staff",
          variant: "compact",
        },
        {
          id: "hospital-tool-machines",
          title: "Machine connectivity",
          description: "Check device uptime, offline stations, and integration drift.",
          eyebrow: "Devices",
          path: "/hospital-admin/machine-connectivity",
          variant: "compact",
        },
        {
          id: "hospital-tool-transfers",
          title: "Transfer command center",
          description: "Open inter-facility routing and continuity handoff workflows.",
          eyebrow: "Continuity",
          path: "/hospital-admin/transfer-command-center",
          variant: "compact",
        },
        {
          id: "hospital-tool-pharmacy",
          title: "Pharmacy referrals",
          description: "Open the pharmacy oversight and coverage workflows.",
          eyebrow: "Pharmacy",
          path: "/hospital-admin/pharmacy-referrals",
          variant: "compact",
        },
      ]}
      recentItems={[
        {
          id: "hospital-recent-training",
          title: "Training tracker",
          description: "Return to readiness gaps, overdue learning, and completion monitoring.",
          eyebrow: "Adoption",
          path: "/admin/training-tracker?status=IN_PROGRESS",
          variant: "compact",
        },
        {
          id: "hospital-recent-consults",
          title: "Consultation monitor",
          description: "Re-open call handling, escalation visibility, and bedside coordination.",
          eyebrow: "Clinical ops",
          path: "/hospital-admin/consultation-monitor",
          variant: "compact",
        },
      ]}
      savedViews={[
        {
          id: "hospital-view-approval-queue",
          title: "Pending approval queue",
          description: "Saved entry into the decisions that need hospital-admin attention first.",
          eyebrow: "Saved view",
          path: "/hospital-admin/approvals?status=PENDING",
          variant: "compact",
        },
        {
          id: "hospital-view-staff-gap",
          title: "Staffing gap pressure",
          description: "Saved entry into staff registration and workforce shortage follow-up.",
          eyebrow: "Saved view",
          path: "/hospital-admin/register-staff",
          variant: "compact",
        },
      ]}
      contextCards={[
        {
          title: "Operational pulse",
          subtitle: "The signals most likely to move today's workload.",
          items: [
            { label: "Offline devices", value: machineStats.offline, tone: machineStats.offline > 0 ? "warn" : "good" },
            { label: "Active consultations", value: data?.activeConsultationCalls ?? 0, tone: data?.activeConsultationCalls > 0 ? "warn" : "good" },
            { label: "Pharmacy risk", value: pharmacyRiskStatus, tone: pharmacyRiskTone },
          ],
          actions: [
            { label: "Open Machine Connectivity", path: "/hospital-admin/machine-connectivity", variant: "secondary" },
            { label: "Consultation Monitor", path: "/hospital-admin/consultation-monitor", variant: "secondary" },
          ],
        },
        {
          title: "Workforce readiness",
          subtitle: "Staff profile, training, and license health for the hospital.",
          items: [
            { label: "At-risk staff", value: staffRiskCount, tone: staffRiskCount > 0 ? "warn" : "good" },
            { label: "Unlinked pharmacists", value: data?.unlinkedPharmacists ?? "—", tone: (data?.unlinkedPharmacists ?? 0) > 0 ? "warn" : "good" },
            { label: "Open shifts", value: data?.openShifts ?? 0, tone: data?.openShifts > 0 ? "warn" : "good" },
          ],
          actions: [
            { label: "Staff directory", path: "/hospital-admin/staff", variant: "secondary" },
            { label: "Training tracker", path: "/admin/training-tracker?status=IN_PROGRESS", variant: "secondary" },
          ],
        },
      ]}
      commandGroups={[
        {
          id: "hospital-command-operations",
          title: "Operations console",
          description: "Open transfer, consultation, device, and capacity workflows.",
          eyebrow: "Operations",
          path: "/hospital-admin/transfer-command-center",
          badge: `${pendingTransfers ?? 0}`,
        },
        {
          id: "hospital-command-workforce",
          title: "Workforce administration",
          description: "Review staff, approvals, training, and hiring from one place.",
          eyebrow: "Workforce",
          path: "/hospital-admin/staff",
        },
        {
          id: "hospital-command-clinical",
          title: "Clinical services",
          description: "Surface appointments, consultations, and patient flow control.",
          eyebrow: "Clinical",
          path: "/hospital-admin/consultation-monitor",
        },
        {
          id: "hospital-command-pharmacy",
          title: "Pharmacy oversight",
          description: "Move pharmacy referrals, medication coverage, and supply signals.",
          eyebrow: "Pharmacy",
          path: "/hospital-admin/pharmacy-referrals",
        },
        {
          id: "hospital-command-finance",
          title: "Finance & compliance",
          description: "Keep revenue, invoices, and claim health visible.",
          eyebrow: "Finance",
          path: "/hospital-admin/financials",
        },
        {
          id: "hospital-command-facility",
          title: "Facility management",
          description: "Track ward capacity, bed flow, and machine health for the hospital.",
          eyebrow: "Facility",
          path: "/hospital-admin/ward-board",
        },
      ]}
    >
      <DashboardSection
        className="doctor-main-grid"
        title="Executive command center"
        subtitle="A reusable widget-based view for operations, finance, and workforce oversight."
      >
        <ExecutiveCommandCenter data={executiveWidgetData} />
      </DashboardSection>

      <DashboardSection
        className="doctor-main-grid"
        title="Transfer continuity"
        subtitle="Latest transfers and pending handovers inside this facility scope."
        actions={[
          { label: "Transfer Command Center", path: "/hospital-admin/transfer-command-center", variant: "secondary" },
          { label: "Ward board", path: "/hospital-admin/ward-board", variant: "secondary" },
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
                {transfers.map((t) => (
                  <tr key={t._id}>
                    <td>
                      {t?.patient ? `${t.patient.firstName || ""} ${t.patient.lastName || ""}`.trim() : "—"}
                    </td>
                    <td>
                      {t?.fromHospital?.name || t?.fromHospital?.code || "—"} {"\u2192"}{" "}
                      {t?.toHospital?.name || t?.toHospital?.code || "—"}
                    </td>
                    <td>{translateText(t.status)}</td>
                  </tr>
                ))}
                {transfers.length === 0 ? (
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
            <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/approvals")}>
              {translateText("Open approvals")}
            </button>
          </div>
        </div>
      </DashboardSection>
    </HospitalAdminCommandCenterShell>
  );
}
