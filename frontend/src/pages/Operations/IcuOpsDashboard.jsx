import React, { useEffect, useState } from "react";
import DashboardHomeShell, { DashboardSection } from "../../components/DashboardHomeShell";
import { getIcuOpsDashboard } from "../../services/dashboardApi";
import { listTransfers } from "../../services/transferApi";
import { useAppLanguage } from "../../utils/appLanguage.jsx";

export default function IcuOpsDashboard() {
  const { translateText } = useAppLanguage();
  const [data, setData] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");

  useEffect(() => {
    getIcuOpsDashboard().then(setData).catch(() => setData(null));
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
      shellKey="operations_icu"
      kicker={translateText("Operations")}
      title={translateText("ICU & Ward Operations")}
      subtitle={translateText("Admissions, inpatients, and high-risk follow-up in a single workbench.")}
      actions={[
        { label: translateText("Open Inpatient Ward"), path: "/app/care/encounters/inpatient" },
        { label: translateText("Bed Board"), path: "/app/operations/bed-board/index", variant: "secondary" },
        { label: translateText("Lab Queue"), path: "/app/operations/lab/test-queue", variant: "secondary" },
      ]}
      stats={[
        { label: translateText("Active Inpatients"), value: data?.activeInpatients ?? "—", path: "/app/care/encounters/inpatient" },
        { label: translateText("Admissions Today"), value: data?.admissionsToday ?? "—", path: "/app/care/encounters/inpatient" },
        { label: translateText("High-Risk Followups"), value: data?.highRiskFollowups ?? "—", path: "/app/operations/bed-board/index" },
        { label: translateText("Pending Lab Results"), value: data?.pendingLabResults ?? "—", path: "/app/operations/lab/test-queue" },
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
          <div className="alert-item">{translateText("Confirm bed availability and escalation rules in Bed Board.")}</div>
          <div className="alert-item">{translateText("Review high-risk follow-ups during shift handover.")}</div>
          <div className="alert-item">{translateText("Ensure pending labs are routed to the queue with urgency tags.")}</div>
        </div>
      </DashboardSection>
    </DashboardHomeShell>
  );
}
