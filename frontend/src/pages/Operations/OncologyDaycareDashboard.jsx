import React from "react";
import DashboardHomeShell, { DashboardSection } from "../../components/DashboardHomeShell";
import { useOperationsDashboard } from "../../hooks/useOperationsDashboard";
import { useAppLanguage } from "../../utils/appLanguage.jsx";

export default function OncologyDaycareDashboard() {
  const { translateText } = useAppLanguage();
  const { data, transfers, transferError, pendingTransfers } = useOperationsDashboard({
    dashboardType: "oncologyDaycare",
  });

  return (
    <DashboardHomeShell
      shellKey="operations_oncology_daycare"
      kicker={translateText("Operations")}
      title={translateText("Oncology Day-Care")}
      subtitle={translateText("Cycle scheduling, chemo order readiness, and continuity actions in one surface.")}
      actions={[
        { label: translateText("Appointments"), path: "/app/operations/scheduling/appointments" },
        { label: translateText("Pharmacy Queue"), path: "/app/operations/pharmacy/prescription-queue", variant: "secondary" },
        { label: translateText("Transfer Command"), path: "/app/operations/transfers/command", variant: "secondary" },
      ]}
      stats={[
        { label: translateText("Cycles Today"), value: data?.cyclesToday ?? "—", path: "/app/operations/units/oncology-daycare" },
        { label: translateText("Upcoming Cycles"), value: data?.upcomingCycles ?? "—", path: "/app/operations/scheduling/appointments" },
        { label: translateText("Active Oncology Cases"), value: data?.activeOncologyCases ?? "—", path: "/app/care/encounters/inpatient" },
        { label: translateText("Pending Chemo Orders"), value: data?.pendingChemoOrders ?? "—", path: "/app/operations/pharmacy/prescription-queue" },
      ]}
    >
      <DashboardSection title={translateText("Transfer Continuity")} subtitle={translateText("Recent transfers and handoff status.")}>
        <div className="action-pill" style={{ marginBottom: 12 }}>
          {translateText("Pending")}: {pendingTransfers}
        </div>
        {transferError ? <div className="muted">{translateText(transferError)}</div> : null}
        <div className="table-wrap">
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
          <div className="alert-item">{translateText("Confirm chemo orders are routed to pharmacy with cycle date.")}</div>
          <div className="alert-item">{translateText("Document adverse event risk notes before transfer completion.")}</div>
          <div className="alert-item">{translateText("Coordinate follow-up visits in appointments for missed cycles.")}</div>
        </div>
      </DashboardSection>
    </DashboardHomeShell>
  );
}
