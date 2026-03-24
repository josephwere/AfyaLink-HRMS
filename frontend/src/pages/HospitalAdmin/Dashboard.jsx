import React, { useEffect, useState } from "react";
import { StatCard } from "../../components/Cards";
import { useAuth } from "../../utils/auth";
import { useNavigate } from "react-router-dom";
import { getHospitalAdminDashboard } from "../../services/dashboardApi";
import { runStaffingForecast } from "../../services/mlApi";
import apiFetch from "../../utils/apiFetch";
import { listTrainingTrackers } from "../../services/trainingTrackerApi";
import { listTransfers } from "../../services/transferApi";
import DashboardHomeShell, { DashboardSection } from "../../components/DashboardHomeShell";
import { useAppLanguage } from "../../utils/appLanguage.jsx";

export default function Dashboard() {
  const { user } = useAuth();
  const { t, translateText } = useAppLanguage();
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
  const [trend, setTrend] = useState({
    requiredDoctors: [],
    requiredNurses: [],
    doctorGap: [],
    nurseGap: [],
    trainingCompletion: [],
  });
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");

  const push = (key, value) => {
    setTrend((prev) => ({
      ...prev,
      [key]: [...(prev[key] || []), Number(value || 0)].slice(-12),
    }));
  };

  const gapStatus = (v) => {
    const n = Number(v || 0);
    if (n <= 0) return "good";
    if (n <= 3) return "warn";
    return "risk";
  };
  const badgeFromStatus = (s) => (s === "risk" ? "ALERT" : s === "warn" ? "WATCH" : "OK");
  const formatInlineStatus = (value, total, key) => `${value}/${total} ${translateText(key)}`;
  const formatWardOccupancy = (occupied, total, available) =>
    `${occupied}/${total} ${translateText("occupied")} • ${available} ${translateText("available")}`;
  const formatGapReason = (count) =>
    t("Gap {count}; >3 requires urgent staffing intervention.", "", { count: Number(count || 0) });

  const loadForecast = async () => {
    try {
      const r = await runStaffingForecast({
        beds: 180,
        occupancyRate: 0.76,
        avgPatientsPerDoctor: 12,
        avgPatientsPerNurse: 5,
        horizonDays: 7,
      });
      setForecast(r || null);
      push("requiredDoctors", r?.forecast?.requiredDoctors || 0);
      push("requiredNurses", r?.forecast?.requiredNurses || 0);
      push("doctorGap", r?.forecast?.doctorGap || 0);
      push("nurseGap", r?.forecast?.nurseGap || 0);
    } catch {
      setForecast(null);
    }
  };

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
        push("trainingCompletion", completionRate);
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
    apiFetch("/api/machine-connectivity/devices")
      .then((r) => {
        const rows = Array.isArray(r?.items) ? r.items : [];
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
  }, [user?.hospital]);

  return (
    <DashboardHomeShell
      className="hospital-admin-dashboard-shell"
      shellKey="hospital-admin"
      kicker="Hospital operations"
      title="Hospital Admin Dashboard"
      subtitle="Daily staffing, service delivery, approvals, and facility operations from one command surface."
      actions={[
        { label: "Staff Directory", path: "/hospital-admin/staff" },
        { label: "Appointment Ops", path: "/hospital-admin/appointments", variant: "secondary" },
        { label: "Consultation Monitor", path: "/hospital-admin/consultation-monitor", variant: "secondary" },
        { label: "Escalation Queue", path: "/hospital-admin/escalations", variant: "secondary" },
        { label: "Revenue Intelligence", path: "/hospital-admin/revenue-intelligence", variant: "secondary" },
      ]}
      stats={[
        { label: "Staff count", value: data?.totalStaff ?? "—", note: "Facility workforce" },
        { label: "Bed occupancy", value: `${data?.bedOccupancyRate ?? "—"}%`, note: `${data?.occupiedBeds ?? 0}/${data?.totalBeds ?? 0} occupied` },
        { label: "Pending approvals", value: data?.pendingRequests ?? "—", note: "Needs admin attention" },
        { label: "Transfer backlog", value: transfers.filter((t) => t.status === "Pending").length, note: "Continuity watch" },
      ]}
      runway={[
        {
          id: "hospital-runway-approvals",
          title: "Clear pending approvals",
          description: "Handle the requests that are slowing staffing, access, and operational flow.",
          eyebrow: "Approvals",
          path: "/hospital-admin/approvals",
          badge: `${data?.pendingRequests ?? 0}`,
        },
        {
          id: "hospital-runway-appointments",
          title: "Open appointment ops",
          description: "Review doctor assignments, queue pressure, and clinic movement from one surface.",
          eyebrow: "Flow",
          path: "/hospital-admin/appointments",
          badge: `${data?.pendingAssignments ?? 0}`,
        },
        {
          id: "hospital-runway-escalations",
          title: "Review ward escalations",
          description: "Resolve the issues delaying consultations, discharge, or transfer handoff.",
          eyebrow: "Escalations",
          path: "/hospital-admin/consultation-monitor",
          badge: `${data?.escalationSummary?.openCount ?? 0}`,
        },
        {
          id: "hospital-runway-revenue",
          title: "Revenue intelligence",
          description: "Keep claims, invoices, and collection signals visible before they become finance drag.",
          eyebrow: "Finance",
          path: "/hospital-admin/revenue-intelligence",
          badge: "Live",
        },
      ]}
      pinnedTools={[
        {
          id: "hospital-tool-staff",
          title: "Staff directory",
          description: "Jump straight into the workforce roster and staffing controls.",
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
            { label: "Training completion %", value: trainingStats.completionRate },
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
            { label: "Doctor gap", value: forecast?.forecast?.doctorGap ?? "—", tone: gapStatus(forecast?.forecast?.doctorGap) },
            { label: "Nurse gap", value: forecast?.forecast?.nurseGap ?? "—", tone: gapStatus(forecast?.forecast?.nurseGap) },
            { label: "Unlinked pharmacists", value: data?.unlinkedPharmacists ?? "—", tone: (data?.unlinkedPharmacists ?? 0) > 0 ? "warn" : "good" },
          ],
          actions: [
            { label: "Recruitment Requests", path: "/hospital-admin/register-staff", variant: "secondary" },
            { label: "Transfer Continuity", path: "/hospital-admin/transfer-command-center", variant: "secondary" },
          ],
        },
      ]}
    >

      <DashboardSection title={translateText("Top Metrics")} subtitle={translateText("The key operational signals your facility team watches first.")}>
        <div className="grid info-grid">
          <StatCard title={translateText("Staff Count")} value={data?.totalStaff ?? "—"} onClick={() => navigate("/hospital-admin/staff")} />
          <StatCard
            title={translateText("Bed Occupancy")}
            value={`${data?.bedOccupancyRate ?? "—"}%`}
            subtitle={formatInlineStatus(data?.occupiedBeds ?? 0, data?.totalBeds ?? 0, "occupied")}
            onClick={() => navigate("/admin/beds")}
          />
          <StatCard title={translateText("Shift Coverage %")} value={data?.openShifts ?? "—"} onClick={() => navigate("/workforce/requests#shift")} />
          <StatCard title={translateText("Department Alerts")} value={data?.pendingRequests ?? "—"} onClick={() => navigate("/hospital-admin/approvals")} />
          <StatCard title={translateText("Pending Doctor Assignments")} value={data?.pendingAssignments ?? "—"} onClick={() => navigate("/hospital-admin/appointments")} />
          <StatCard title={translateText("Active Consultation Calls")} value={data?.activeConsultationCalls ?? "—"} onClick={() => navigate("/hospital-admin/appointments")} />
          <StatCard title={translateText("Open Ward Escalations")} value={data?.escalationSummary?.openCount ?? "—"} onClick={() => navigate("/hospital-admin/consultation-monitor")} />
          <StatCard
            title={translateText("Unlinked Pharmacists")}
            value={data?.unlinkedPharmacists ?? "—"}
            onClick={() => navigate("/hospital-admin/staff?missingRegisteredPharmacy=1&q=pharmacist")}
          />
          <StatCard
            title={translateText("Training Completion %")}
            value={trainingStats.completionRate}
            trend={trend.trainingCompletion}
            subtitle={formatInlineStatus(trainingStats.completed, trainingStats.total, "completed")}
            onClick={() => navigate("/admin/training-tracker?status=IN_PROGRESS")}
          />
        </div>
      </DashboardSection>

      <DashboardSection title={translateText("Training Tracker")} subtitle={translateText("Readiness, completion, and overdue learning signals across your hospital.")}>
        <div className="grid info-grid">
          <StatCard title={translateText("Total Trainees")} value={trainingStats.total} onClick={() => navigate("/admin/training-tracker")} />
          <StatCard title={translateText("Not Started")} value={trainingStats.notStarted} onClick={() => navigate("/admin/training-tracker?status=NOT_STARTED")} />
          <StatCard title={translateText("In Progress")} value={trainingStats.inProgress} onClick={() => navigate("/admin/training-tracker?status=IN_PROGRESS")} />
          <StatCard title={translateText("Completed")} value={trainingStats.completed} onClick={() => navigate("/admin/training-tracker?status=COMPLETED")} />
          <StatCard title={translateText("Overdue Not Started")} value={trainingStats.overdueNotStarted} onClick={() => navigate("/admin/training-tracker?status=NOT_STARTED")} />
          <StatCard title={translateText("Overdue In Progress")} value={trainingStats.overdueInProgress} onClick={() => navigate("/admin/training-tracker?status=IN_PROGRESS")} />
        </div>
      </DashboardSection>

      <DashboardSection title={translateText("AI Staffing Risk")} subtitle={translateText("Forecast-driven hiring pressure and staffing gaps in one view.")}>
        <div className="grid info-grid">
          <StatCard title={translateText("Required Doctors")} value={forecast?.forecast?.requiredDoctors ?? "—"} trend={trend.requiredDoctors} subtitle={translateText("Auto-refresh 45s")} onClick={() => navigate("/hospital-admin/register-staff?role=doctor")} />
          <StatCard title={translateText("Required Nurses")} value={forecast?.forecast?.requiredNurses ?? "—"} trend={trend.requiredNurses} subtitle={translateText("Auto-refresh 45s")} onClick={() => navigate("/hospital-admin/register-staff?role=nurse")} />
          <StatCard
            title={translateText("Doctor Gap")}
            value={forecast?.forecast?.doctorGap ?? "—"}
            trend={trend.doctorGap}
            subtitle={translateText("Auto-refresh 45s")}
            status={gapStatus(forecast?.forecast?.doctorGap)}
            badge={badgeFromStatus(gapStatus(forecast?.forecast?.doctorGap))}
            why={formatGapReason(forecast?.forecast?.doctorGap)}
            onClick={() => navigate("/hospital-admin/register-staff?role=doctor")}
            onBadgeClick={() => navigate("/hospital-admin/register-staff?role=doctor")}
          />
          <StatCard
            title={translateText("Nurse Gap")}
            value={forecast?.forecast?.nurseGap ?? "—"}
            trend={trend.nurseGap}
            subtitle={translateText("Auto-refresh 45s")}
            status={gapStatus(forecast?.forecast?.nurseGap)}
            badge={badgeFromStatus(gapStatus(forecast?.forecast?.nurseGap))}
            why={formatGapReason(forecast?.forecast?.nurseGap)}
            onClick={() => navigate("/hospital-admin/register-staff?role=nurse")}
            onBadgeClick={() => navigate("/hospital-admin/register-staff?role=nurse")}
          />
        </div>
      </DashboardSection>

      <DashboardSection
        className="doctor-main-grid"
        title={translateText("Daily command")}
        subtitle={translateText("Your operational runway for staffing, queues, finance, and internal alerts.")}
      >
        <div className="card doctor-schedule-card">
          <h3>{translateText("Main Tasks")}</h3>
          <div className="panel-grid">
            <button type="button" className="action-link" onClick={() => navigate("/workforce/requests#shift")}>{translateText("Shift Calendar")}</button>
            <button type="button" className="action-link" onClick={() => navigate("/hospital-admin/appointments")}>{translateText("Appointment Queue")}</button>
            <button type="button" className="action-link" onClick={() => navigate("/hospital-admin/appointment-analytics")}>{translateText("Demand Analytics")}</button>
            <button type="button" className="action-link" onClick={() => navigate("/hospital-admin/transfer-command-center")}>{translateText("Transfer Command Center")}</button>
            <button type="button" className="action-link" onClick={() => navigate("/reports")}>{translateText("Attendance Heatmap")}</button>
            <button type="button" className="action-link" onClick={() => navigate("/hospital-admin/staff")}>{translateText("Staff Directory")}</button>
            <button type="button" className="action-link" onClick={() => navigate("/hospital-admin/staff?missingRegisteredPharmacy=1&q=pharmacist")}>{translateText("Fix Pharmacy Links")}</button>
            <button type="button" className="action-link" onClick={() => navigate("/hospital-admin/financials")}>{translateText("Budget & Financials")}</button>
            <button type="button" className="action-link" onClick={() => navigate("/hospital-admin/pharmacy-referrals")}>{translateText("Nearest Pharmacy Routing")}</button>
            <button type="button" className="action-link" onClick={() => navigate("/admin/training-tracker?role=NURSE&status=IN_PROGRESS")}>{translateText("Training Tracker Board")}</button>
          </div>
        </div>

        <div className="card doctor-alerts-card">
          <h3>{translateText("Alerts")}</h3>
          <div className="alert-stack">
            <div className="action-pill">{translateText("Pending Approvals")}: {data?.pendingRequests ?? "—"}</div>
            <div className="action-pill">{translateText("Critical Alerts")}: {data?.appointmentsToday ?? "—"}</div>
            <div className="action-pill">{translateText("Pharmacists Linked")}: {data?.linkedPharmacists ?? "—"}/{data?.pharmacists ?? "—"}</div>
            {(data?.unreadPharmacyRiskNotifications ?? 0) > 0 ? (
              <div className="action-pill" style={{ borderColor: "#ef4444", color: "#ef4444" }}>
                {translateText("Pharmacy Risk Unread")}: {data?.unreadPharmacyRiskNotifications}
              </div>
            ) : null}
            {data?.pharmacyCoverageRisk ? (
              <div className="action-pill" style={{ borderColor: "#ef4444", color: "#ef4444" }}>
                {translateText("Pharmacy feature is on but no pharmacist is linked to a pharmacy.")}
              </div>
            ) : null}
            {!data?.pharmacyCoverageRisk && data?.pharmacyLinkageWarning ? (
              <div className="action-pill" style={{ borderColor: "#f59e0b", color: "#f59e0b" }}>
                {translateText("Some pharmacists still need pharmacy links.")}
              </div>
            ) : null}
            <button type="button" className="btn-secondary" onClick={() => navigate("/notifications")}>{translateText("Announcements")}</button>
            {(data?.pharmacyCoverageRisk || data?.pharmacyLinkageWarning) ? (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => navigate("/notifications?category=PHARMACY&read=UNREAD")}
              >
                {translateText("Pharmacy Risk Alerts")}{(data?.unreadPharmacyRiskNotifications ?? 0) > 0 ? ` (${data.unreadPharmacyRiskNotifications})` : ""}
              </button>
            ) : null}
            <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/approvals")}>{translateText("Incident Reports")}</button>
          </div>
        </div>
      </DashboardSection>

      <DashboardSection
        className="doctor-main-grid"
        title={translateText("Transfer Continuity")}
        subtitle={translateText("Recent transfers and handoff status.")}
      >
        <div className="card doctor-schedule-card">
          <div className="card-header-actions">
            <div>
              <h3>{translateText("Transfer Continuity")}</h3>
              <p className="muted">{translateText("Recent transfers and handoff status.")}</p>
            </div>
            <div className="action-pill">
              {translateText("Pending")}: {transfers.filter((t) => t.status === "Pending").length}
            </div>
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
            <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/transfer-command-center")}>
              {translateText("Open Transfer Command Center")}
            </button>
            <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/ward-board")}>
              {translateText("Ward Board")}
            </button>
          </div>
        </div>
        <div className="card doctor-alerts-card">
          <h3>{translateText("Continuity Actions")}</h3>
          <div className="alert-stack">
            <div className="alert-item">{translateText("Confirm consent scopes before export or acceptance.")}</div>
            <div className="alert-item">{translateText("Review handover missing fields before completion.")}</div>
            <div className="alert-item">{translateText("Escalate pending transfers past 24h.")}</div>
          </div>
        </div>
      </DashboardSection>

      <section className="section">
        <h3>{translateText("Ward Escalations")}</h3>
        <div className="card">
          <div className="card-header-actions">
            <div>
              <p className="muted">{translateText("Facility-level view of nurse-raised blockers that need clinician or admin follow-up.")}</p>
            </div>
            <div className="action-pill warning">{translateText("Open")}: {data?.escalationSummary?.openCount ?? 0}</div>
          </div>
          <div className="alert-stack" style={{ marginTop: 12 }}>
            {(data?.escalationSummary?.items || []).slice(0, 8).map((item) => (
              <div key={item.id} className="card">
                <div className="card-header-actions">
                  <div>
                    <strong>{item.patientName}</strong>
                    <div className="muted" style={{ marginTop: 4 }}>
                      {item.resolvedAt ? translateText("Resolved") : translateText("Needs follow-up")}
                      {item.missingRequirements?.length ? ` • ${translateText("Missing")}: ${item.missingRequirements.join(", ")}` : ""}
                    </div>
                  </div>
                  <div className={`action-pill${item.resolvedAt ? "" : " warning"}`}>
                    {item.resolvedAt ? translateText("Resolved") : translateText("Open")}
                  </div>
                </div>
                <p className="muted" style={{ marginTop: 8 }}>{item.body || item.title}</p>
                <div className="doctor-actions-row" style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => navigate(item.path || "/hospital-admin/escalations")}
                  >
                    {translateText("Open Workflow")}
                  </button>
                </div>
              </div>
            ))}
            {!(data?.escalationSummary?.items || []).length ? (
              <div className="action-pill">{translateText("No ward escalations in this hospital.")}</div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="section">
        <h3>{translateText("Ward Occupancy")}</h3>
        <div className="grid info-grid">
          {Array.isArray(data?.wardOccupancy) && data.wardOccupancy.length ? (
            data.wardOccupancy.map((ward) => (
              <StatCard
                key={ward.ward}
                title={ward.ward}
                value={`${ward.occupancyRate}%`}
                subtitle={formatWardOccupancy(ward.occupied, ward.total, ward.available)}
                onClick={() => navigate("/hospital-admin/ward-board")}
              />
            ))
          ) : (
            <div className="card muted">{translateText("No ward occupancy data yet.")}</div>
          )}
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card doctor-alerts-card">
          <h3>{translateText("Recent Bed Activity")}</h3>
          <div className="alert-stack">
            {Array.isArray(data?.recentBedEvents) && data.recentBedEvents.length ? (
              data.recentBedEvents.map((event) => {
                const moveFrom = [event?.metadata?.fromWard, event?.metadata?.fromNumber].filter(Boolean).join(" - ");
                const moveTo = [event?.metadata?.toWard, event?.metadata?.toNumber].filter(Boolean).join(" - ");
                return (
                  <div key={event._id} className="alert-item">
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <strong>{String(event.action || "").replaceAll("_", " ")}</strong>
                      <span className="muted">{new Date(event.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="muted">
                      {translateText("By")} {event?.actor?.name || translateText("System")}{event?.actor?.role ? ` • ${translateText(event.actor.role)}` : ""}
                    </div>
                    {moveFrom || moveTo ? (
                      <div className="muted">
                        {moveFrom || translateText("Unknown")} {" -> "} {moveTo || translateText("Unknown")}
                      </div>
                    ) : null}
                    {event?.metadata?.ward || event?.metadata?.number ? (
                      <div className="muted">
                        {translateText("Bed")}: {[event?.metadata?.ward, event?.metadata?.number].filter(Boolean).join(" - ")}
                      </div>
                    ) : null}
                    {event?.metadata?.note ? <div>{event.metadata.note}</div> : null}
                  </div>
                );
              })
            ) : (
              <div className="card muted">{translateText("No bed movement events yet.")}</div>
            )}
            <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/ward-board")}>
              {translateText("Open Bed Operations")}
            </button>
          </div>
        </div>

        <div className="card doctor-schedule-card">
          <h3>{translateText("Ward Actions")}</h3>
          <div className="panel-grid">
            <button type="button" className="action-link" onClick={() => navigate("/hospital-admin/ward-board")}>{translateText("Assign Beds")}</button>
            <button type="button" className="action-link" onClick={() => navigate("/hospital-admin/ward-board")}>{translateText("Transfer Patients")}</button>
            <button type="button" className="action-link" onClick={() => navigate("/hospital-admin/ward-board")}>{translateText("Discharge Beds")}</button>
            <button type="button" className="action-link" onClick={() => navigate("/hospital-admin/transfer-command-center")}>{translateText("Transfer Continuity")}</button>
          </div>
        </div>
      </section>

      <section className="section">
        <h3>{translateText("Machine Connectivity")}</h3>
        <div className="grid info-grid">
          <StatCard title={translateText("Connected Devices")} value={machineStats.total} onClick={() => navigate("/hospital-admin/machine-connectivity")} />
          <StatCard title={translateText("Online")} value={machineStats.online} onClick={() => navigate("/hospital-admin/machine-connectivity")} />
          <StatCard title={translateText("Offline")} value={machineStats.offline} onClick={() => navigate("/hospital-admin/machine-connectivity")} />
          <StatCard title={translateText("Error")} value={machineStats.error} onClick={() => navigate("/hospital-admin/machine-alerts")} />
          <StatCard title={translateText("Maintenance")} value={machineStats.maintenance} onClick={() => navigate("/hospital-admin/machine-connectivity")} />
        </div>
        <div className="action-list" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="action-link"
            onClick={() => navigate("/hospital-admin/machine-connectivity")}
          >
            {translateText("Open Machine Connectivity Console")}
          </button>
          <button
            type="button"
            className="action-link"
            onClick={() => navigate("/hospital-admin/machine-alerts")}
          >
            {translateText("View Machine Alerts")}
          </button>
        </div>
      </section>
    </DashboardHomeShell>
  );
}
