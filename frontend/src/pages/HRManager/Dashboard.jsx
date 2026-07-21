import React from "react";
import DashboardHomeShell, { DashboardSection } from "../../components/DashboardHomeShell";
import { StatCard } from "../../components/Cards";
import { useHRManagerDashboard } from "../../hooks/useHRManagerDashboard";
import { useAppLanguage } from "../../utils/appLanguage.jsx";

export default function HRManagerDashboard() {
  const { translateText } = useAppLanguage();
  const {
    data,
    burnout,
    causal,
    training,
    trend,
    transfers,
    transferError,
    burnoutStatus,
    changeStatus,
    badgeFromStatus,
  } = useHRManagerDashboard();

  return (
    <DashboardHomeShell
      shellKey="people_hr_manager"
      kicker={translateText("People")}
      title={translateText("HR Manager")}
      subtitle={translateText("Hiring, staff readiness, training completeness, and workforce intelligence.")}
      actions={[
        { label: translateText("Recruitment Pipeline"), path: "/app/people/staff/register" },
        { label: translateText("Employee Profiles"), path: "/app/people/staff/index", variant: "secondary" },
        { label: translateText("Leave Management"), path: "/app/people/requests/index", variant: "secondary" },
        { label: translateText("Training Tracker"), path: "/app/people/training/tracker?status=IN_PROGRESS", variant: "secondary" },
      ]}
      stats={[
        { label: translateText("Pending Requests"), value: data?.pendingRequests?.total ?? "—", path: "/app/people/requests/index" },
        { label: translateText("Incomplete Staff"), value: data?.incompleteStaff ?? "—", path: "/app/people/staff/index" },
        { label: translateText("Training Completion %"), value: training.completionRate, path: "/app/people/training/tracker" },
        { label: translateText("Burnout Score"), value: burnout?.score ?? "—", path: "/app/people/requests/index?status=PENDING" },
      ]}
    >
      <DashboardSection title={translateText("Training Tracker")} subtitle={translateText("Keep onboarding and compliance training moving without chasing spreadsheets.")}>
        <div className="grid info-grid">
          <StatCard title={translateText("Total Trainees")} value={training.total} path="/app/people/training/tracker" />
          <StatCard title={translateText("Not Started")} value={training.notStarted} path="/app/people/training/tracker?status=NOT_STARTED" />
          <StatCard title={translateText("In Progress")} value={training.inProgress} path="/app/people/training/tracker?status=IN_PROGRESS" />
          <StatCard title={translateText("Completed")} value={training.completed} path="/app/people/training/tracker?status=COMPLETED" />
          <StatCard title={translateText("Overdue Not Started")} value={training.overdueNotStarted} path="/app/people/training/tracker?status=NOT_STARTED" />
          <StatCard title={translateText("Overdue In Progress")} value={training.overdueInProgress} path="/app/people/training/tracker?status=IN_PROGRESS" />
        </div>
      </DashboardSection>

      <DashboardSection title={translateText("Transfer Continuity")} subtitle={translateText("Operational handoffs that affect staffing coverage and leave planning.")}>
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
                  <td>
                    {t?.patient?.firstName || ""} {t?.patient?.lastName || ""}
                  </td>
                  <td>
                    {t?.fromHospital?.name || t?.fromHospital?.code || "—"} →{" "}
                    {t?.toHospital?.name || t?.toHospital?.code || "—"}
                  </td>
                  <td>{translateText(t.status)}</td>
                </tr>
              ))}
              {transfers.length === 0 ? (
                <tr>
                  <td colSpan="3" className="muted">
                    {translateText("No transfers yet.")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </DashboardSection>

      <DashboardSection title={translateText("AI Workforce Intelligence")} subtitle={translateText("Auto-refresh signals that help prioritize staffing and training interventions.")}>
        <div className="grid info-grid">
          <StatCard
            title={translateText("Burnout Score")}
            value={burnout?.score ?? "—"}
            trend={trend.burnoutScore}
            subtitle={translateText("Auto-refresh 45s")}
            status={burnoutStatus(burnout?.score)}
            badge={badgeFromStatus(burnoutStatus(burnout?.score))}
            why={translateText(`Burnout score ${burnout?.score ?? 0}; >=75 high risk, 45-74 medium.`)}
            path="/app/people/requests/index?status=PENDING"
          />
          <StatCard
            title={translateText("Burnout Band")}
            value={burnout?.band ?? "—"}
            path="/app/people/requests/index?status=PENDING"
          />
          <StatCard
            title={translateText("Projected KPI")}
            value={causal?.projected ?? "—"}
            trend={trend.projectedKpi}
            subtitle={translateText("Auto-refresh 45s")}
            status={changeStatus(causal?.changePct)}
            badge={badgeFromStatus(changeStatus(causal?.changePct))}
            why={translateText(`Projected KPI is ${causal?.projected ?? 0}; negative expected change means risk.`)}
            path="/app/people/staff/register"
          />
          <StatCard
            title={translateText("Projected Change %")}
            value={causal?.changePct ?? "—"}
            trend={trend.projectedChange}
            subtitle={translateText("Auto-refresh 45s")}
            status={changeStatus(causal?.changePct)}
            badge={badgeFromStatus(changeStatus(causal?.changePct))}
            why={translateText(`Change ${causal?.changePct ?? 0}%; <0 is risk, 0-3 is watch.`)}
            path="/app/people/staff/register"
          />
        </div>
      </DashboardSection>
    </DashboardHomeShell>
  );
}

