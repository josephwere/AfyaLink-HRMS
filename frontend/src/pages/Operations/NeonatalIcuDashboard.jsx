import React, { useEffect, useState } from "react";
import DashboardHomeShell, { DashboardSection } from "../../components/DashboardHomeShell";
import { getNeonatalIcuDashboard } from "../../services/dashboardApi";
import { listTransfers } from "../../services/transferApi";
import { useAppLanguage } from "../../utils/appLanguage.jsx";

export default function NeonatalIcuDashboard() {
  const { translateText } = useAppLanguage();
  const [data, setData] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");

  useEffect(() => {
    getNeonatalIcuDashboard().then(setData).catch(() => setData(null));
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
      shellKey="operations_neonatal_icu"
      kicker={translateText("Operations")}
      title={translateText("Neonatal ICU")}
      subtitle={translateText("NICU admissions, critical labs, and high-risk follow-up without stacked dashboards.")}
      actions={[
        { label: translateText("Open ICU Ops"), path: "/app/operations/units/icu" },
        { label: translateText("Inpatient Ward"), path: "/app/care/encounters/inpatient", variant: "secondary" },
        { label: translateText("Lab Queue"), path: "/app/operations/lab/test-queue", variant: "secondary" },
      ]}
      stats={[
        { label: translateText("Admissions Today"), value: data?.nicuAdmissionsToday ?? "—", path: "/app/operations/units/neonatal-icu" },
        { label: translateText("Active NICU Cases"), value: data?.activeNicuCases ?? "—", path: "/app/care/encounters/inpatient" },
        { label: translateText("High-Risk Followups"), value: data?.highRiskFollowups ?? "—", path: "/app/operations/bed-board/index" },
        { label: translateText("Pending Critical Labs"), value: data?.pendingCriticalLabs ?? "—", path: "/app/operations/lab/test-queue" },
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
          <div className="alert-item">{translateText("Confirm NICU handover notes include feeding and oxygen status.")}</div>
          <div className="alert-item">{translateText("Escalate missing critical labs in the lab queue before transfer completion.")}</div>
          <div className="alert-item">{translateText("Use Bed Board to coordinate high-risk follow-up coverage.")}</div>
        </div>
      </DashboardSection>
    </DashboardHomeShell>
  );
}
