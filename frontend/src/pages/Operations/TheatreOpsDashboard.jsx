import React, { useEffect, useState } from "react";
import DashboardHomeShell, { DashboardSection } from "../../components/DashboardHomeShell";
import { getTheatreOpsDashboard } from "../../services/dashboardApi";
import { listTransfers } from "../../services/transferApi";
import { useAppLanguage } from "../../utils/appLanguage.jsx";

export default function TheatreOpsDashboard() {
  const { translateText } = useAppLanguage();
  const [data, setData] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");

  useEffect(() => {
    getTheatreOpsDashboard().then(setData).catch(() => setData(null));
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
      shellKey="operations_theatre"
      kicker={translateText("Operations")}
      title={translateText("Theatre Operations")}
      subtitle={translateText("Surgery flow, post-op handoff, and theatre readiness without clutter.")}
      actions={[
        { label: translateText("Surgery Workspace"), path: "/app/care/encounters/surgery" },
        { label: translateText("Inpatient Ward"), path: "/app/care/encounters/inpatient", variant: "secondary" },
        { label: translateText("Bed Board"), path: "/app/operations/bed-board/index", variant: "secondary" },
      ]}
      stats={[
        { label: translateText("Surgeries Today"), value: data?.surgeriesToday ?? "—", path: "/app/care/encounters/surgery" },
        { label: translateText("Upcoming Surgeries"), value: data?.upcomingSurgeries ?? "—", path: "/app/care/encounters/surgery" },
        { label: translateText("Active Encounters"), value: data?.activeSurgicalEncounters ?? "—", path: "/app/care/encounters/inpatient" },
        { label: translateText("Post-op Followups"), value: data?.postOpFollowups ?? "—", path: "/app/operations/bed-board/index" },
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
          <div className="alert-item">{translateText("Attach theatre notes before transfer completion.")}</div>
          <div className="alert-item">{translateText("Confirm surgical clearance in handover summary.")}</div>
          <div className="alert-item">{translateText("Coordinate post-op follow-up with receiving team.")}</div>
        </div>
      </DashboardSection>
    </DashboardHomeShell>
  );
}
