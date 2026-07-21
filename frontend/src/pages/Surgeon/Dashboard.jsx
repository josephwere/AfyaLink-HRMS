import React from "react";
import DashboardHomeShell, { DashboardSection } from "../../components/DashboardHomeShell";
import { useSurgeonDashboard } from "../../hooks/useSurgeonDashboard";
import { useAppLanguage } from "../../utils/appLanguage.jsx";

export default function SurgeonDashboard() {
  const { translateText } = useAppLanguage();
  const { data, transfers, transferError } = useSurgeonDashboard();

  return (
    <DashboardHomeShell
      shellKey="care_surgeon"
      kicker={translateText("Care")}
      title={translateText("Surgery")}
      subtitle={translateText("Theatre schedule, procedures, and transfer continuity.")}
      actions={[
        { label: translateText("Surgery Workspace"), path: "/app/care/encounters/surgery" },
        { label: translateText("Theatre Ops"), path: "/app/operations/units/theatre", variant: "secondary" },
        { label: translateText("Transfer Command"), path: "/app/operations/transfers/command", variant: "secondary" },
      ]}
      stats={[
        { label: translateText("Surgeries Today"), value: data?.surgeriesToday ?? "—", path: "/app/care/encounters/surgery" },
        { label: translateText("Upcoming Surgeries"), value: data?.upcomingSurgeries ?? "—", path: "/app/operations/units/theatre" },
        { label: translateText("Active Encounters"), value: data?.activeEncounters ?? "—", path: "/app/care/encounters/inpatient" },
        { label: translateText("Unread Notifications"), value: data?.unreadNotifications ?? "—", path: "/app/platform/inbox/notifications" },
      ]}
    >
      <DashboardSection title={translateText("Transfer Continuity")} subtitle={translateText("Recent transfers and handoff status.")}>
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

      <DashboardSection title={translateText("Continuity Actions")} subtitle={translateText("What to do next.")}>
        <div className="alert-stack">
          <div className="alert-item">{translateText("Attach theatre notes before transfer completion.")}</div>
          <div className="alert-item">{translateText("Confirm surgical clearance in handover summary.")}</div>
          <div className="alert-item">{translateText("Coordinate post-op follow-up with receiving team.")}</div>
        </div>
      </DashboardSection>
    </DashboardHomeShell>
  );
}

