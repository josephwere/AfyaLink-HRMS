import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
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
        { label: translateText("Shift Info"), value: translateText("Active"), note: translateText("Current nursing shift") },
        { label: translateText("Assigned Patients"), value: data?.patientsTotal ?? "—", note: translateText("Current workload") },
        { label: translateText("Medication Due Alerts"), value: data?.pendingLabOrders ?? "—", note: translateText("Needs action") },
        { label: translateText("Open Escalations"), value: data?.escalationSummary?.openCount ?? "—", note: translateText("Continuity watch") },
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
      <DashboardSection title={translateText("Nursing Snapshot")} subtitle={translateText("Key workload and continuity signals for the shift.")}>
        <div className="grid info-grid">
          <StatCard title={translateText("Shift Info")} value={translateText("Active")} onClick={() => navigate("/nurse/shift")} />
          <StatCard title={translateText("Assigned Patients")} value={data?.patientsTotal ?? "—"} onClick={() => navigate("/nurse/patients")} />
          <StatCard title={translateText("Medication Due Alerts")} value={data?.pendingLabOrders ?? "—"} onClick={() => navigate("/nurse/medication")} />
          <StatCard title={translateText("Pending Requests")} value={data?.pendingRequests?.total ?? "—"} onClick={() => navigate("/nurse/ward-board")} />
          <StatCard title={translateText("Open Escalations")} value={data?.escalationSummary?.openCount ?? "—"} onClick={() => navigate("/nurse/patients")} />
        </div>
      </DashboardSection>

      <DashboardSection className="doctor-main-grid" title={translateText("Main Tasks")} subtitle={translateText("The core nursing workflows you return to throughout the shift.")}>
        <div className="card doctor-schedule-card">
          <div className="panel-grid">
            <button className="action-link" type="button" onClick={() => navigate("/nurse/patients")}>{translateText("Patient Task List")}</button>
            <button className="action-link" type="button" onClick={() => navigate("/nurse/medication")}>{translateText("Medication Administration")}</button>
            <button className="action-link" type="button" onClick={() => navigate("/nurse/vitals")}>{translateText("Vitals Entry")}</button>
            <button className="action-link" type="button" onClick={() => navigate("/nurse/ward-board")}>{translateText("Ward Board")}</button>
            <button className="action-link" type="button" onClick={() => navigate("/nurse/incidents")}>{translateText("Incident Reports")}</button>
          </div>
        </div>

        <div className="card doctor-alerts-card">
          <h3>{translateText("Alerts")}</h3>
          <div className="alert-stack">
            <div className="action-pill">{translateText("Critical Alerts")}: {data?.appointmentsToday ?? "—"}</div>
            <div className="action-pill">{translateText("Leave Pending")}: {data?.pendingRequests?.leave ?? "—"}</div>
            <button className="btn-secondary" type="button" onClick={() => navigate("/workforce/requests")}>{translateText("Open My Requests")}</button>
          </div>
        </div>
      </DashboardSection>

      <DashboardSection className="doctor-main-grid" title={translateText("Transfer Continuity")} subtitle={translateText("Recent transfers and handoff status.")}>
        <div className="card doctor-schedule-card">
          <div className="card-header-actions">
            <div>
              <h3>{translateText("Transfer Continuity")}</h3>
              <p className="muted">{translateText("Recent transfers and handoff status.")}</p>
            </div>
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
        <div className="card doctor-alerts-card">
          <h3>{translateText("Handoff Checklist")}</h3>
          <div className="alert-stack">
            <div className="alert-item">{translateText("Confirm vitals and meds before transfer handoff.")}</div>
            <div className="alert-item">{translateText("Log outstanding labs or imaging for receiving team.")}</div>
            <div className="alert-item">{translateText("Escalate missing consent to the command center.")}</div>
          </div>
        </div>
      </DashboardSection>

      <DashboardSection title={translateText("Escalation Board")} subtitle={translateText("Blocked discharge and transfer issues waiting for clinician action.")}>
        <div className="card">
          <div className="card-header-actions">
            <div>
              <h3>{translateText("Escalation Board")}</h3>
              <p className="muted">{translateText("Blocked discharge and transfer issues waiting for clinician action.")}</p>
            </div>
            <div className="action-pill">{translateText("Open")}: {data?.escalationSummary?.openCount ?? 0}</div>
          </div>
          <div className="alert-stack" style={{ marginTop: 12 }}>
            {(data?.escalationSummary?.items || []).slice(0, 6).map((item) => (
              <div key={item.id} className="card">
                <div className="card-header-actions">
                  <div>
                    <strong>{item.patientName}</strong>
                    <div className="muted" style={{ marginTop: 4 }}>
                      {item.resolvedAt ? translateText("Resolved") : translateText("Awaiting clinician review")}
                      {item.missingRequirements?.length ? ` • Missing: ${item.missingRequirements.join(", ")}` : ""}
                    </div>
                  </div>
                  <div className={`action-pill${item.resolvedAt ? "" : " warning"}`}>
                    {item.resolvedAt ? translateText("Resolved") : translateText("Open")}
                  </div>
                </div>
                <p className="muted" style={{ marginTop: 8 }}>{item.body || item.title}</p>
                <div className="doctor-actions-row" style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => navigate(item.patientId ? `/nurse/vitals?patientId=${item.patientId}` : "/nurse/vitals")}
                  >
                    {translateText("Open Patient")}
                  </button>
                </div>
              </div>
            ))}
            {!(data?.escalationSummary?.items || []).length ? (
              <div className="action-pill">{translateText("No escalation activity yet.")}</div>
            ) : null}
          </div>
        </div>
      </DashboardSection>
    </DashboardHomeShell>
  );
}
