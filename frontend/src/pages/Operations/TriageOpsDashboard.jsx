import React, { useEffect, useState } from "react";
import DashboardHomeShell, { DashboardSection } from "../../components/DashboardHomeShell";
import { getTriageOpsDashboard } from "../../services/dashboardApi";
import { listTransfers } from "../../services/transferApi";
import { useAppLanguage } from "../../utils/appLanguage.jsx";

export default function TriageOpsDashboard() {
  const { translateText } = useAppLanguage();
  const [data, setData] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");

  useEffect(() => {
    getTriageOpsDashboard().then(setData).catch(() => setData(null));
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
      shellKey="operations_triage"
      kicker={translateText("Operations")}
      title={translateText("Triage Operations")}
      subtitle={translateText("Arrivals, triage backlog, and urgent routing without stacked dashboards.")}
      actions={[
        { label: translateText("Emergency Command"), path: "/app/operations/emergency/command" },
        { label: translateText("Appointments"), path: "/app/operations/scheduling/appointments", variant: "secondary" },
        { label: translateText("Transfer Command"), path: "/app/operations/transfers/command", variant: "secondary" },
      ]}
      stats={[
        { label: translateText("Arrivals Today"), value: data?.arrivalsToday ?? "—", path: "/app/operations/triage/index" },
        { label: translateText("Pending Triage"), value: data?.pendingTriage ?? "—", path: "/app/operations/triage/index" },
        { label: translateText("Active Encounters"), value: data?.activeEncounters ?? "—", path: "/app/care/encounters/inpatient" },
        { label: translateText("Urgent Lab Backlog"), value: data?.urgentLabBacklog ?? "—", path: "/app/operations/lab/test-queue" },
      ]}
    >
      <DashboardSection
        title={translateText("Transfer Continuity")}
        subtitle={translateText("Recent transfers and handoff status.")}>
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

      <DashboardSection
        title={translateText("Continuity Actions")}
        subtitle={translateText("What to do next.")}>
        <div className="alert-stack">
          <div className="alert-item">{translateText("Confirm triage category for all arrivals before handoff.")}</div>
          <div className="alert-item">{translateText("Escalate unstable cases to emergency command immediately.")}</div>
          <div className="alert-item">{translateText("Route urgent labs to the test queue with clear triage notes.")}</div>
        </div>
      </DashboardSection>
    </DashboardHomeShell>
  );
}
