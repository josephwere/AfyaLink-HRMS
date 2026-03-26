import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../utils/auth";
import { getHospitalAdminDashboard } from "../../services/dashboardApi";
import { runStaffingForecast } from "../../services/mlApi";
import { listTrainingTrackers } from "../../services/trainingTrackerApi";
import { listTransfers } from "../../services/transferApi";
import DashboardHomeShell, { DashboardSection } from "../../components/DashboardHomeShell";
import { useAppLanguage } from "../../utils/appLanguage.jsx";
import { guardedConsoleFetch } from "../../services/guardedConsoleFetch";

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
  const { user } = useAuth();
  const { translateText } = useAppLanguage();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [machineStats, setMachineStats] = useState({
    total: 0,
    online: 0,
    offline: 0,
    error: 0,
    maintenance: 0,
  });
  const [trainingStats, setTrainingStats] = useState({
    total: 0,
    notStarted: 0,
    inProgress: 0,
    completed: 0,
    overdueNotStarted: 0,
    overdueInProgress: 0,
    completionRate: 0,
  });
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");

  const loadForecast = useCallback(async () => {
    try {
      const r = await runStaffingForecast({
        beds: 180,
        occupancyRate: 0.76,
        avgPatientsPerDoctor: 12,
        avgPatientsPerNurse: 5,
        horizonDays: 7,
      });
      setForecast(r || null);
    } catch {
      setForecast(null);
    }
  }, []);

  useEffect(() => {
    getHospitalAdminDashboard().then(setData).catch(() => setData(null));
    loadForecast();

    listTrainingTrackers({ hospital: user?.hospital || undefined, limit: 200 })
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
        setTrainingStats({
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
        setTrainingStats({
          total: 0,
          notStarted: 0,
          inProgress: 0,
          completed: 0,
          overdueNotStarted: 0,
          overdueInProgress: 0,
          completionRate: 0,
        })
      );

    listTransfers({ limit: 8, scope: "facility" })
      .then((res) => {
        const items = Array.isArray(res?.items) ? res.items : [];
        setTransfers(items);
        setTransferError("");
      })
      .catch((err) => {
        setTransfers([]);
        setTransferError(err?.message || "Failed to load transfers.");
      });

    guardedConsoleFetch("/api/machine-connectivity/devices", {
      warmupKey: "hospital-admin-machine-connectivity",
    })
      .then((result) => {
        const rows = Array.isArray(result?.payload?.items) ? result.payload.items : [];
        setMachineStats({
          total: rows.length,
          online: rows.filter((d) => d.status === "ONLINE").length,
          offline: rows.filter((d) => d.status === "OFFLINE").length,
          error: rows.filter((d) => d.status === "ERROR").length,
          maintenance: rows.filter((d) => d.status === "MAINTENANCE").length,
        });
      })
      .catch(() => {
        setMachineStats({ total: 0, online: 0, offline: 0, error: 0, maintenance: 0 });
      });

    const timer = setInterval(loadForecast, 45000);
    return () => clearInterval(timer);
  }, [loadForecast, user?.hospital]);

  const pendingTransfers = useMemo(
    () => transfers.filter((t) => t.status === "Pending").length,
    [transfers]
  );

  const overdueLearning = trainingStats.overdueNotStarted + trainingStats.overdueInProgress;
  const machineAlerts = machineStats.offline + machineStats.error;

  return (
    <DashboardHomeShell
      className="hospital-admin-dashboard-shell"
      shellKey="hospital-admin"
      kicker="Hospital operations"
      title="Hospital Admin Dashboard"
      subtitle="Daily staffing, service delivery, approvals, and facility operations from one command surface."
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
          path: "/admin/beds",
        },
        { label: "Pending approvals", value: data?.pendingRequests ?? "—", note: "Needs admin attention", path: "/hospital-admin/approvals" },
        { label: "Transfer backlog", value: pendingTransfers, note: "Continuity watch", path: "/hospital-admin/transfer-command-center" },
      ]}
      brief={{
        kicker: "Daily brief",
        title: "What needs action now",
        body: "Start with approvals, connectivity drift, and continuity handoffs.",
        items: [
          {
            label: "Pending approvals",
            value: data?.pendingRequests ?? 0,
            tone: clampNumber(data?.pendingRequests, 0) > 0 ? "warn" : "good",
          },
          {
            label: "Offline devices",
            value: machineStats.offline,
            tone: machineStats.offline > 0 ? "warn" : "good",
          },
          {
            label: "Training completion %",
            value: trainingStats.completionRate,
            tone: completionTone(trainingStats.completionRate),
          },
          {
            label: "Pending transfers",
            value: pendingTransfers,
            tone: pendingTransfers > 0 ? "warn" : "good",
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
          id: "hospital-runway-transfers",
          title: "Transfer continuity",
          description: "Track pending handovers and prevent transfer delays.",
          eyebrow: "Continuity",
          path: "/hospital-admin/transfer-command-center",
          badge: `${pendingTransfers}`,
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
          id: "hospital-runway-appointments",
          title: "Appointment ops",
          description: "Review doctor assignments, queue pressure, and clinic movement from one surface.",
          eyebrow: "Flow",
          path: "/hospital-admin/appointments",
          badge: `${data?.pendingAssignments ?? 0}`,
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
          id: "hospital-tool-revenue",
          title: "Revenue intelligence",
          description: "Keep claims, invoices, and collection signals visible.",
          eyebrow: "Finance",
          path: "/hospital-admin/revenue-intelligence",
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
          description: "Saved view into staff registration and workforce shortage follow-up.",
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
            { label: "Training completion %", value: trainingStats.completionRate, tone: completionTone(trainingStats.completionRate) },
            { label: "Pharmacy risk", value: data?.pharmacyCoverageRisk ? "Active" : "Clear", tone: data?.pharmacyCoverageRisk ? "risk" : "good" },
          ],
          actions: [
            { label: "Open Machine Connectivity", path: "/hospital-admin/machine-connectivity", variant: "secondary" },
            { label: "Training Tracker", path: "/admin/training-tracker?status=IN_PROGRESS", variant: "secondary" },
          ],
        },
        {
          title: "Staffing intelligence",
          subtitle: "AI staffing pressure paired with operational action.",
          items: [
            { label: "Doctor gap", value: forecast?.forecast?.doctorGap ?? "—", tone: gapTone(forecast?.forecast?.doctorGap) },
            { label: "Nurse gap", value: forecast?.forecast?.nurseGap ?? "—", tone: gapTone(forecast?.forecast?.nurseGap) },
            { label: "Unlinked pharmacists", value: data?.unlinkedPharmacists ?? "—", tone: (data?.unlinkedPharmacists ?? 0) > 0 ? "warn" : "good" },
          ],
          actions: [
            { label: "Recruitment Requests", path: "/hospital-admin/register-staff", variant: "secondary" },
            { label: "Transfer Continuity", path: "/hospital-admin/transfer-command-center", variant: "secondary" },
          ],
        },
      ]}
    >
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
    </DashboardHomeShell>
  );
}
