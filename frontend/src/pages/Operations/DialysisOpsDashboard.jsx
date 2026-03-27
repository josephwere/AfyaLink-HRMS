import React, { useEffect, useState } from "react";
import DashboardHomeShell, { DashboardSection } from "../../components/DashboardHomeShell";
import { getDialysisOpsDashboard } from "../../services/dashboardApi";
import { listTransfers } from "../../services/transferApi";
import { useAppLanguage } from "../../utils/appLanguage.jsx";

export default function DialysisOpsDashboard() {
  const { translateText } = useAppLanguage();
  const [data, setData] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");

  useEffect(() => {
    getDialysisOpsDashboard().then(setData).catch(() => setData(null));
    listTransfers({ limit: 6, scope: "facility" })
      .then((resp) => {
        const items = Array.isArray(resp?.items) ? resp.items : Array.isArray(resp) ? resp : [];
        setTransfers(items);
        setTransferError("");
      })
      .catch((err) => {
        setTransfers([]);
        setTransferError(err?.message || "Unable to load transfers.");
      });
  }, []);

  const pendingTransfers = transfers.filter(
    (t) => String(t?.status || "").toUpperCase() === "PENDING"
  ).length;

  return (
    <DashboardHomeShell
      shellKey="operations_dialysis"
      kicker={translateText("Operations")}
      title={translateText("Dialysis Operations")}
      subtitle={translateText("Sessions, delays, and transfer continuity in one clean workbench.")}
      actions={[
        { label: translateText("Appointments"), path: "/app/operations/scheduling/appointments" },
        { label: translateText("Transfer Command"), path: "/app/operations/transfers/command", variant: "secondary" },
        { label: translateText("Inpatient Ward"), path: "/app/care/encounters/inpatient", variant: "secondary" },
      ]}
      stats={[
        { label: translateText("Sessions Today"), value: data?.sessionsToday ?? "—", path: "/app/operations/units/dialysis" },
        { label: translateText("Upcoming Sessions"), value: data?.upcomingSessions ?? "—", path: "/app/operations/scheduling/appointments" },
        { label: translateText("Active Dialysis Cases"), value: data?.activeDialysisCases ?? "—", path: "/app/care/encounters/inpatient" },
        { label: translateText("Delayed Sessions"), value: data?.delayedSessions ?? "—", path: "/app/operations/transfers/command" },
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
          <div className="alert-item">{translateText("Confirm delayed sessions have documented reasons and recovery plan.")}</div>
          <div className="alert-item">{translateText("Coordinate transfer handoffs to avoid session disruption.")}</div>
          <div className="alert-item">{translateText("Review active dialysis cases in inpatient ward for risk follow-ups.")}</div>
        </div>
      </DashboardSection>
    </DashboardHomeShell>
  );
}
