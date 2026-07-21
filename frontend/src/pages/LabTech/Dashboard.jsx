import React from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { useAppLanguage } from "../../utils/appLanguage.jsx";
import DashboardHomeShell, { DashboardSection } from "../../components/DashboardHomeShell";
import { useLabTechDashboard } from "../../hooks/useLabTechDashboard";

export default function LabTechDashboard() {
  const { translateText } = useAppLanguage();
  const navigate = useNavigate();
  const { data, transfers, transferError } = useLabTechDashboard();

  return (
    <DashboardHomeShell
      className="labtech-dashboard-shell"
      shellKey="lab-tech-dashboard"
      kicker={translateText("Diagnostics workspace")}
      title={translateText("Lab Technician Diagnostics")}
      subtitle={translateText("Test queue, sample tracking, quality control, and transfer continuity in one lab control surface.")}
      actions={[
        { label: translateText("Test Queue"), path: "/lab-tech/test-queue" },
        { label: translateText("Equipment Logs"), path: "/lab-tech/equipment", variant: "secondary" },
        { label: translateText("Reports Archive"), path: "/lab-tech/archive", variant: "secondary" },
      ]}
      stats={[
        { label: translateText("Pending Tests"), value: data?.pendingOrders ?? "—", note: translateText("Needs processing") },
        { label: translateText("Completed Today"), value: data?.completedToday ?? "—", note: translateText("Completed output") },
        { label: translateText("Abnormal Results"), value: data?.overdueOrders ?? "—", note: translateText("Requires attention") },
        { label: translateText("Orders Today"), value: data?.ordersToday ?? "—", note: translateText("Incoming demand") },
      ]}
      brief={{
        kicker: translateText("Daily brief"),
        title: translateText("What the lab should move first"),
        body: translateText("Start with urgent tests, flagged results, and any transfers waiting on diagnostic handoff."),
        items: [
          { label: translateText("Pending Tests"), value: data?.pendingOrders ?? "—", tone: Number(data?.pendingOrders || 0) > 0 ? "warn" : "good" },
          { label: translateText("Abnormal Results"), value: data?.overdueOrders ?? "—", tone: Number(data?.overdueOrders || 0) > 0 ? "warn" : "good" },
          { label: translateText("Pending transfers"), value: transfers.filter((t) => t.status === "Pending").length, tone: transfers.some((t) => t.status === "Pending") ? "warn" : "good" },
        ],
      }}
      runway={[
        { id: "lab-runway-tests", title: translateText("Test processing table"), description: translateText("Move straight into the active test queue and keep turnaround times tight."), eyebrow: translateText("Queue"), path: "/lab-tech/test-queue", badge: `${data?.pendingOrders ?? 0}` },
        { id: "lab-runway-samples", title: translateText("Sample tracking"), description: translateText("Track sample movement, routing, and lab handoff without losing continuity."), eyebrow: translateText("Samples"), path: "/lab-tech/samples", badge: translateText("Live") },
        { id: "lab-runway-qc", title: translateText("Quality control"), description: translateText("Open abnormal or flagged results and keep the lab quality loop tight."), eyebrow: translateText("Quality"), path: "/lab-tech/qc", badge: `${data?.overdueOrders ?? 0}` },
        { id: "lab-runway-transfers", title: translateText("Transfer continuity"), description: translateText("Review transfers where pending results or sample handoff still matter."), eyebrow: translateText("Continuity"), path: "/hospital-admin/transfer-command-center", badge: `${transfers.filter((t) => t.status === "Pending").length}` },
      ]}
      pinnedTools={[
        { id: "lab-tool-safety", title: translateText("Safety Checklist"), description: translateText("Keep lab safety workflows one click away."), eyebrow: translateText("Pinned"), path: "/lab-tech/safety", variant: "compact" },
        { id: "lab-tool-equipment", title: translateText("Equipment Logs"), description: translateText("Check machines, maintenance, and diagnostics health quickly."), eyebrow: translateText("Pinned"), path: "/lab-tech/equipment", variant: "compact" },
        { id: "lab-tool-archive", title: translateText("Reports Archive"), description: translateText("Return to completed outputs and archived results fast."), eyebrow: translateText("Pinned"), path: "/lab-tech/archive", variant: "compact" },
      ]}
      recentItems={[
        { id: "lab-recent-tests", title: translateText("Test Queue"), description: translateText("Re-open the active diagnostics queue you were just working through."), eyebrow: translateText("Recent"), path: "/lab-tech/test-queue", variant: "compact" },
        { id: "lab-recent-transfer", title: translateText("Transfer Command Center"), description: translateText("Return to continuity handoff when a transfer depends on lab completion."), eyebrow: translateText("Recent"), path: "/hospital-admin/transfer-command-center", variant: "compact" },
      ]}
      savedViews={[
        { id: "lab-saved-qc", title: translateText("Quality control view"), description: translateText("Saved entry into flagged results and lab quality follow-up."), eyebrow: translateText("Saved view"), path: "/lab-tech/qc", variant: "compact" },
        { id: "lab-saved-samples", title: translateText("Sample handoff view"), description: translateText("Saved entry into sample movement and continuity checks."), eyebrow: translateText("Saved view"), path: "/lab-tech/samples", variant: "compact" },
      ]}
      contextCards={[
        {
          title: translateText("Lab context"),
          subtitle: translateText("The signals most likely to shape the next diagnostic cycle."),
          items: [
            { label: translateText("Urgent Flagged"), value: data?.overdueOrders ?? "—", tone: Number(data?.overdueOrders || 0) > 0 ? "warn" : "good" },
            { label: translateText("Completed Today"), value: data?.completedToday ?? "—" },
            { label: translateText("Pending transfers"), value: transfers.filter((t) => t.status === "Pending").length, tone: transfers.some((t) => t.status === "Pending") ? "warn" : "good" },
          ],
          actions: [
            { label: translateText("Quality Control"), path: "/lab-tech/qc", variant: "secondary" },
            { label: translateText("Transfer Command Center"), path: "/hospital-admin/transfer-command-center", variant: "secondary" },
          ],
        },
      ]}
    >
      <DashboardSection title={translateText("Lab Metrics")} subtitle={translateText("Key queue, result, and throughput signals at a glance.")}>
        <div className="grid info-grid">
          <StatCard title={translateText("Pending Tests")} value={data?.pendingOrders ?? "—"} onClick={() => navigate("/lab-tech/test-queue")} />
          <StatCard title={translateText("Completed Today")} value={data?.completedToday ?? "—"} onClick={() => navigate("/lab-tech/archive")} />
          <StatCard title={translateText("Abnormal Results")} value={data?.overdueOrders ?? "—"} onClick={() => navigate("/lab-tech/qc")} />
          <StatCard title={translateText("Orders Today")} value={data?.ordersToday ?? "—"} onClick={() => navigate("/lab-tech/test-queue")} />
        </div>
      </DashboardSection>

      <DashboardSection className="doctor-main-grid" title={translateText("Main Tasks")} subtitle={translateText("The lab workflows you come back to most often.")}>
        <div className="card doctor-schedule-card">
          <div className="panel-grid">
            <button type="button" className="action-link" onClick={() => navigate("/lab-tech/test-queue")}>{translateText("Test Processing Table")}</button>
            <button type="button" className="action-link" onClick={() => navigate("/lab-tech/samples")}>{translateText("Sample Tracking")}</button>
            <button type="button" className="action-link" onClick={() => navigate("/lab-tech/qc")}>{translateText("Quality Control")}</button>
            <button type="button" className="action-link" onClick={() => navigate("/lab-tech/safety")}>{translateText("Safety Checklist")}</button>
          </div>
        </div>

        <div className="card doctor-alerts-card">
          <h3>{translateText("Alerts")}</h3>
          <div className="alert-stack">
            <div className="action-pill">{translateText("Equipment Status: Live")}</div>
            <div className="action-pill">{translateText("Urgent Flagged")}: {data?.overdueOrders ?? "—"}</div>
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
            <div className="action-pill">{translateText("Pending")}: {transfers.filter((t) => t.status === "Pending").length}</div>
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
            <button type="button" className="btn-secondary" onClick={() => navigate("/lab-tech/test-queue")}>
              {translateText("Test Queue")}
            </button>
            <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/transfer-command-center")}>
              {translateText("Transfer Command Center")}
            </button>
          </div>
        </div>
        <div className="card doctor-alerts-card">
          <h3>{translateText("Continuity Actions")}</h3>
          <div className="alert-stack">
            <div className="alert-item">{translateText("Attach pending results before transfer completion.")}</div>
            <div className="alert-item">{translateText("Flag abnormal labs for receiving team.")}</div>
            <div className="alert-item">{translateText("Coordinate sample handoff when needed.")}</div>
          </div>
        </div>
      </DashboardSection>
    </DashboardHomeShell>
  );
}
