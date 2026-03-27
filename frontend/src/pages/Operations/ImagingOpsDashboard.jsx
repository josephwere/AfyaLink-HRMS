import React, { useEffect, useState } from "react";
import DashboardHomeShell, { DashboardSection } from "../../components/DashboardHomeShell";
import { getImagingOpsDashboard } from "../../services/dashboardApi";
import { listTransfers } from "../../services/transferApi";
import { useAppLanguage } from "../../utils/appLanguage.jsx";

export default function ImagingOpsDashboard() {
  const { translateText } = useAppLanguage();
  const [data, setData] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");

  useEffect(() => {
    getImagingOpsDashboard().then(setData).catch(() => setData(null));
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
      shellKey="operations_imaging"
      kicker={translateText("Operations")}
      title={translateText("Imaging Operations")}
      subtitle={translateText("Imaging queue health, critical reads backlog, and equipment readiness.")}
      actions={[
        { label: translateText("Open Imaging Queue"), path: "/app/operations/units/imaging" },
        { label: translateText("Equipment Alerts"), path: "/app/operations/devices/alerts", variant: "secondary" },
        { label: translateText("Transfer Command"), path: "/app/operations/transfers/command", variant: "secondary" },
      ]}
      stats={[
        { label: translateText("Pending Imaging"), value: data?.imagingPending ?? "—", path: "/app/operations/units/imaging" },
        { label: translateText("Completed Today"), value: data?.imagingCompletedToday ?? "—", path: "/app/operations/units/imaging" },
        { label: translateText("Critical Reads Backlog"), value: data?.criticalReadsBacklog ?? "—", path: "/app/operations/units/imaging" },
        { label: translateText("Open Equipment Issues"), value: data?.openEquipmentIssues ?? "—", path: "/app/operations/devices/alerts" },
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
          <div className="alert-item">{translateText("Attach imaging reports before transfer completion.")}</div>
          <div className="alert-item">{translateText("Flag missing imaging results for handover summary.")}</div>
          <div className="alert-item">{translateText("Escalate equipment downtime via Equipment Alerts.")}</div>
        </div>
      </DashboardSection>
    </DashboardHomeShell>
  );
}
