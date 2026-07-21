import React from "react";
import DashboardHomeShell, { DashboardSection } from "../../components/DashboardHomeShell";
import { useTherapistDashboard } from "../../hooks/useTherapistDashboard";
import { useAppLanguage } from "../../utils/appLanguage.jsx";

export default function TherapistDashboard() {
  const { translateText } = useAppLanguage();
  const { data, transfers, transferError } = useTherapistDashboard();

  return (
    <DashboardHomeShell
      shellKey="care_therapist"
      kicker={translateText("Care")}
      title={translateText("Therapy")}
      subtitle={translateText("Sessions, follow-up, and transfer continuity.")}
      actions={[
        { label: translateText("Appointments"), path: "/app/operations/scheduling/appointments" },
        { label: translateText("My Requests"), path: "/app/people/requests/index", variant: "secondary" },
      ]}
      stats={[
        { label: translateText("Appointments Today"), value: data?.appointmentsToday ?? "—", path: "/app/operations/scheduling/appointments" },
        { label: translateText("Upcoming Appointments"), value: data?.upcomingAppointments ?? "—", path: "/app/operations/scheduling/appointments" },
        { label: translateText("Unread Notifications"), value: data?.unreadNotifications ?? "—", path: "/app/platform/inbox/notifications" },
        { label: translateText("My Pending Requests"), value: data?.myPendingRequests ?? "—", path: "/app/people/requests/index" },
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
          <div className="alert-item">{translateText("Share therapy plan updates before transfer completion.")}</div>
          <div className="alert-item">{translateText("Flag rehab needs in handover summary.")}</div>
          <div className="alert-item">{translateText("Coordinate follow-up sessions with receiving team.")}</div>
        </div>
      </DashboardSection>
    </DashboardHomeShell>
  );
}

