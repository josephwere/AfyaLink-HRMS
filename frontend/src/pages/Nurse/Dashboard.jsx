import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getNurseDashboard } from "../../services/dashboardApi";
import { listTransfers } from "../../services/transferApi";
import { useAppLanguage } from "../../utils/appLanguage.jsx";
import DashboardHomeShell, { DashboardSection } from "../../components/DashboardHomeShell";

export default function NurseDashboard() {
  const { translateText } = useAppLanguage();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");

  useEffect(() => {
    getNurseDashboard().then(setData).catch(() => setData(null));
    listTransfers({ limit: 6, scope: "facility" })
      .then((res) => {
        const items = Array.isArray(res?.items) ? res.items : [];
        setTransfers(items);
        setTransferError("");
      })
      .catch((err) => {
        setTransfers([]);
        setTransferError(err?.message || "Failed to load transfers.");
      });
  }, []);

  return (
    <DashboardHomeShell
      className="nurse-dashboard-shell"
      shellKey="nurse-dashboard"
      kicker={translateText("Clinical workspace")}
      title={translateText("Nurse Clinical Operations")}
      subtitle={translateText("Daily nursing tasks, patient handoff, and ward continuity from one clear workspace.")}
      actions={[
        { label: translateText("Open Shift"), path: "/nurse/shift" },
        { label: translateText("Record Vitals"), path: "/nurse/vitals", variant: "secondary" },
        { label: translateText("Give Medication"), path: "/nurse/medication", variant: "secondary" },
        { label: translateText("Ward Board"), path: "/nurse/ward-board", variant: "secondary" },
      ]}
      stats={[
        { label: translateText("Shift Info"), value: translateText("Active"), note: translateText("Current nursing shift"), path: "/nurse/shift" },
        { label: translateText("Assigned Patients"), value: data?.patientsTotal ?? "—", note: translateText("Current workload"), path: "/nurse/patients" },
        { label: translateText("Medication Due Alerts"), value: data?.pendingLabOrders ?? "—", note: translateText("Needs action"), path: "/nurse/medication" },
        { label: translateText("Open Escalations"), value: data?.escalationSummary?.openCount ?? "—", note: translateText("Continuity watch"), path: "/nurse/ward-board" },
      ]}
      brief={{
        kicker: translateText("Daily brief"),
        title: translateText("What nursing needs to move first"),
        body: translateText("Start with medication timing, ward-board blockers, and transfer handoff continuity."),
        items: [
          { label: translateText("Medication Due Alerts"), value: data?.pendingLabOrders ?? "—", tone: Number(data?.pendingLabOrders || 0) > 0 ? "warn" : "good" },
          { label: translateText("Leave Pending"), value: data?.pendingRequests?.leave ?? "—" },
          { label: translateText("Pending transfers"), value: transfers.filter((t) => t.status === "Pending").length, tone: transfers.some((t) => t.status === "Pending") ? "warn" : "good" },
        ],
      }}
      runway={[
        { id: "nurse-runway-patients", title: translateText("Patient task list"), description: translateText("Open the patients who need bedside action, review, or follow-up next."), eyebrow: translateText("Patients"), path: "/nurse/patients", badge: translateText("Live") },
        { id: "nurse-runway-meds", title: translateText("Medication administration"), description: translateText("Work through medication timing and bedside delivery without leaving the workspace."), eyebrow: translateText("Meds"), path: "/nurse/medication", badge: translateText("Due") },
        { id: "nurse-runway-vitals", title: translateText("Vitals entry"), description: translateText("Capture new vitals and keep the ward view current for clinicians."), eyebrow: translateText("Monitoring"), path: "/nurse/vitals", badge: translateText("Open") },
        { id: "nurse-runway-transfers", title: translateText("Transfer continuity"), description: translateText("Review handoff status and close any missing transfer details quickly."), eyebrow: translateText("Continuity"), path: "/hospital-admin/transfer-command-center", badge: `${transfers.filter((t) => t.status === "Pending").length}` },
      ]}
      pinnedTools={[
        { id: "nurse-tool-ward", title: translateText("Ward Board"), description: translateText("Keep bed-side flow and pending requests close."), eyebrow: translateText("Pinned"), path: "/nurse/ward-board", variant: "compact" },
        { id: "nurse-tool-incidents", title: translateText("Incident Reports"), description: translateText("Open safety and escalation reporting without hunting through menus."), eyebrow: translateText("Pinned"), path: "/nurse/incidents", variant: "compact" },
        { id: "nurse-tool-requests", title: translateText("My Requests"), description: translateText("Jump back into leave and staffing requests fast."), eyebrow: translateText("Pinned"), path: "/workforce/requests", variant: "compact" },
      ]}
      recentItems={[
        { id: "nurse-recent-shift", title: translateText("Shift workspace"), description: translateText("Re-open your live nursing shift and handoff context."), eyebrow: translateText("Recent"), path: "/nurse/shift", variant: "compact" },
        { id: "nurse-recent-transfer", title: translateText("Transfer continuity"), description: translateText("Return to transfer updates and pending handoff issues."), eyebrow: translateText("Recent"), path: "/hospital-admin/transfer-command-center", variant: "compact" },
      ]}
      savedViews={[
        { id: "nurse-saved-escalations", title: translateText("Open escalations"), description: translateText("Saved view for unresolved patient and discharge blockers."), eyebrow: translateText("Saved view"), path: "/nurse/patients", variant: "compact" },
        { id: "nurse-saved-vitals", title: translateText("Vitals round"), description: translateText("Saved entry into the next bedside documentation flow."), eyebrow: translateText("Saved view"), path: "/nurse/vitals", variant: "compact" },
      ]}
      contextCards={[
        {
          title: translateText("Ward context"),
          subtitle: translateText("The signals most likely to shape the next nursing hour."),
          items: [
            { label: translateText("Pending requests"), value: data?.pendingRequests?.total ?? "—" },
            { label: translateText("Open escalations"), value: data?.escalationSummary?.openCount ?? "—", tone: Number(data?.escalationSummary?.openCount || 0) > 0 ? "warn" : "good" },
            { label: translateText("Critical alerts"), value: data?.appointmentsToday ?? "—" },
          ],
          actions: [
            { label: translateText("Ward Board"), path: "/nurse/ward-board", variant: "secondary" },
            { label: translateText("Transfer Command Center"), path: "/hospital-admin/transfer-command-center", variant: "secondary" },
          ],
        },
      ]}
    >
      <DashboardSection className="doctor-main-grid" title={translateText("Transfer Continuity")} subtitle={translateText("Recent transfers and handoff status.")}>
        <div className="card doctor-schedule-card">
          <div className="card-header-actions">
            <div className="action-pill">
              {translateText("Pending")}: {transfers.filter((t) => t.status === "Pending").length}
            </div>
          </div>
          {transferError ? <div className="muted">{translateText(transferError)}</div> : null}
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
                    <td>{t?.patient?.firstName || ""} {t?.patient?.lastName || ""}</td>
                    <td>{t?.fromHospital?.name || t?.fromHospital?.code || "—"} → {t?.toHospital?.name || t?.toHospital?.code || "—"}</td>
                    <td>{translateText(t.status)}</td>
                  </tr>
                ))}
                {transfers.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="muted">{translateText("No transfers yet.")}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="doctor-actions-row" style={{ marginTop: 12 }}>
            <button className="btn-secondary" type="button" onClick={() => navigate("/hospital-admin/transfer-command-center")}>
              {translateText("Transfer Command Center")}
            </button>
            <button className="btn-secondary" type="button" onClick={() => navigate("/nurse/ward-board")}>
              {translateText("Ward Board")}
            </button>
          </div>
        </div>
      </DashboardSection>
    </DashboardHomeShell>
  );
}
