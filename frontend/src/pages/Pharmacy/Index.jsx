import React from "react";
import { Link } from "react-router-dom";
import DashboardHomeShell, { DashboardSection } from "../../components/DashboardHomeShell";
import { useAppLanguage } from "../../utils/appLanguage.jsx";
import usePharmacyDashboard from "../../hooks/usePharmacyDashboard";

export default function PharmacyDashboard() {
  const { translateText } = useAppLanguage();
  const { items, prescriptions, transfers, error, loading, lowStock, pendingPrescriptions, dispensedToday, pendingTransfers } = usePharmacyDashboard({ limit: 25 });

  return (
    <DashboardHomeShell
      shellKey="operations_pharmacy_home"
      kicker={translateText("Operations")}
      title={translateText("Pharmacy")}
      subtitle={translateText("Dispensing queue, stock risk, and safety checks without stacked dashboards.")}
      actions={[
        { label: translateText("Prescription Queue"), path: "/app/operations/pharmacy/prescription-queue" },
        { label: translateText("Inventory"), path: "/app/operations/pharmacy/inventory", variant: "secondary" },
        { label: translateText("Expiry Alerts"), path: "/app/operations/pharmacy/expiry", variant: "secondary" },
        { label: translateText("Reports"), path: "/app/operations/pharmacy/reports", variant: "secondary" },
      ]}
      stats={[
        { label: translateText("Pending Prescriptions"), value: pendingPrescriptions, path: "/app/operations/pharmacy/prescription-queue" },
        { label: translateText("Dispensed"), value: dispensedToday, path: "/app/operations/pharmacy/prescription-queue" },
        { label: translateText("Low Stock Alerts"), value: lowStock, path: "/app/operations/pharmacy/inventory" },
        { label: translateText("Expiring Drugs"), value: translateText("Live"), path: "/app/operations/pharmacy/expiry" },
        { label: translateText("Controlled Drugs"), value: translateText("Tracked"), path: "/app/operations/pharmacy/controlled" },
      ]}
    >
      <DashboardSection title={translateText("Dispensing Queue")} subtitle={translateText("Latest prescriptions awaiting action.")}>
        <div className="table-wrap">
          <table className="doctor-table">
            <thead>
              <tr>
                <th>{translateText("Patient")}</th>
                <th>{translateText("Prescription")}</th>
                <th>{translateText("Status")}</th>
                <th>{translateText("Doctor")}</th>
              </tr>
            </thead>
            <tbody>
              {prescriptions.slice(0, 10).map((i) => (
                <tr key={i._id}>
                  <td>
                    {i?.patientRecord?.firstName
                      ? `${i.patientRecord.firstName} ${i.patientRecord.lastName || ""}`.trim()
                      : "—"}
                  </td>
                  <td>{i.summary || i?.appointment?.serviceType || "—"}</td>
                  <td>{translateText(i.status)}</td>
                  <td>{i?.doctor?.name || "—"}</td>
                </tr>
              ))}
              {prescriptions.length === 0 ? (
                <tr>
                  <td colSpan="4" className="muted">
                    {translateText("No prescriptions")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </DashboardSection>

      <DashboardSection title={translateText("Interaction Alerts")} subtitle={translateText("Safety posture and quick next actions.")}>
        <div className="alert-stack">
          <div className="action-pill">{translateText("Drug interaction checks active")}</div>
          <div className="doctor-actions-row" style={{ marginTop: 10 }}>
            <Link className="btn-secondary" to="/app/operations/pharmacy/reports">
              {translateText("Open Safety Reports")}
            </Link>
          </div>
        </div>
      </DashboardSection>

      <DashboardSection title={translateText("Transfer Continuity")} subtitle={translateText("Recent transfers and handoff status.")}>
        <div className="action-pill" style={{ marginBottom: 12 }}>
          {translateText("Pending")}: {pendingTransfers}
        </div>
        {error ? <div className="muted">{translateText(error)}</div> : null}
        {loading ? <div className="muted">{translateText("Loading pharmacy overview...")}</div> : null}
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
          <div className="alert-item">{translateText("Route prescriptions to nearest linked pharmacy.")}</div>
          <div className="alert-item">{translateText("Attach substitution notes before transfer completion.")}</div>
          <div className="alert-item">{translateText("Flag stock-outs for transfer handover summary.")}</div>
        </div>
      </DashboardSection>
    </DashboardHomeShell>
  );
}
