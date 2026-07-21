import React from "react";
import DashboardHomeShell, { DashboardSection } from "../../components/DashboardHomeShell";
import { useRadiologistDashboard } from "../../hooks/useRadiologistDashboard";
import { useAppLanguage } from "../../utils/appLanguage.jsx";

export default function RadiologistDashboard() {
  const { translateText } = useAppLanguage();
  const { data, transfers, transferError, pendingTransfers } = useRadiologistDashboard();

  return (
    <DashboardHomeShell
      shellKey="care_radiologist"
      kicker={translateText("Care")}
      title={translateText("Radiology")}
      subtitle={translateText("Imaging orders, reporting turnaround, and transfer continuity.")}
      actions={[
        { label: translateText("Imaging Ops"), path: "/app/operations/units/imaging" },
        { label: translateText("Transfer Command"), path: "/app/operations/transfers/command", variant: "secondary" },
        { label: translateText("My Requests"), path: "/app/people/requests/index", variant: "secondary" },
      ]}
      stats={[
        { label: translateText("Pending Imaging Orders"), value: data?.pendingImagingOrders ?? "—", path: "/app/operations/units/imaging" },
        { label: translateText("Completed Today"), value: data?.completedToday ?? "—", path: "/app/operations/units/imaging" },
        { label: translateText("Unread Notifications"), value: data?.unreadNotifications ?? "—", path: "/app/platform/inbox/notifications" },
        { label: translateText("My Pending Requests"), value: data?.myPendingRequests ?? "—", path: "/app/people/requests/index" },
      ]}
    >
      <DashboardSection title={translateText("Transfer Continuity")} subtitle={translateText("Recent transfers and handoff status.")}>
        {transferError ? <div className="muted">{translateText(transferError)}</div> : null}
        <div className="action-pill" style={{ marginBottom: 12 }}>
          {translateText("Pending")}: {pendingTransfers}
        </div>
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
          <div className="alert-item">{translateText("Attach imaging reports before transfer completion.")}</div>
          <div className="alert-item">{translateText("Flag missing imaging results for handover summary.")}</div>
          <div className="alert-item">{translateText("Coordinate with receiving radiology team for pending reads.")}</div>
        </div>
      </DashboardSection>
    </DashboardHomeShell>
  );
}

