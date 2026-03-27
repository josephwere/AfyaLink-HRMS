import React, { useEffect, useState } from "react";
import DashboardHomeShell, { DashboardSection } from "../../components/DashboardHomeShell";
import { getEmergencyCommandDashboard } from "../../services/dashboardApi";
import { listTransfers } from "../../services/transferApi";
import { useAppLanguage } from "../../utils/appLanguage.jsx";

export default function EmergencyCommandDashboard() {
  const { translateText } = useAppLanguage();
  const [data, setData] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");

  useEffect(() => {
    getEmergencyCommandDashboard().then(setData).catch(() => setData(null));
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
      shellKey="operations_emergency_command"
      kicker={translateText("Operations")}
      title={translateText("Emergency Command")}
      subtitle={translateText("Escalations, dispatch, and triage routing in one command surface.")}
      actions={[
        { label: translateText("Open Triage"), path: "/app/operations/triage/index" },
        { label: translateText("Communication Center"), path: "/app/platform/inbox/communication", variant: "secondary" },
        { label: translateText("Security Admin"), path: "/app/platform/security/admin/home", variant: "secondary" },
      ]}
      stats={[
        { label: translateText("Active Emergencies"), value: data?.activeEmergencies ?? "—", path: "/app/operations/triage/index" },
        { label: translateText("Escalated Incidents"), value: data?.escalatedIncidents ?? "—", path: "/app/platform/security/admin/home" },
        { label: translateText("Dispatches Today"), value: data?.ambulanceDispatchesToday ?? "—", path: "/app/platform/inbox/communication" },
        { label: translateText("Triage Backlog"), value: data?.triageBacklog ?? "—", path: "/app/operations/triage/index" },
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

      <DashboardSection title={translateText("Command Actions")} subtitle={translateText("Quick next steps for escalation workflows.")}>
        <div className="alert-stack">
          <div className="alert-item">{translateText("Confirm triage escalations are acknowledged within SLA.")}</div>
          <div className="alert-item">{translateText("Use Communication Center to coordinate dispatch updates.")}</div>
          <div className="alert-item">{translateText("Hand off active incidents to Security Admin if needed.")}</div>
        </div>
      </DashboardSection>
    </DashboardHomeShell>
  );
}
