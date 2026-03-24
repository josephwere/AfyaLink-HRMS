import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { getReceptionistDashboard } from "../../services/dashboardApi";
import { listTransfers } from "../../services/transferApi";
import { useAppLanguage } from "../../utils/appLanguage.jsx";
import DashboardHomeShell, { DashboardSection } from "../../components/DashboardHomeShell";

export default function ReceptionistDashboard() {
  const navigate = useNavigate();
  const { translateText } = useAppLanguage();
  const [data, setData] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");

  useEffect(() => {
    getReceptionistDashboard().then(setData).catch(() => setData(null));
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
      className="receptionist-dashboard-shell"
      shellKey="receptionist-dashboard"
      kicker={translateText("Front desk workspace")}
      title={translateText("Receptionist Dashboard")}
      subtitle={translateText("Booking, check-in, continuity handoff, and front-desk communication in one clear workspace.")}
      actions={[
        { label: translateText("My Requests"), path: "/workforce/requests" },
        {
          label: translateText("Booking Desk"),
          path: "/receptionist/booking-desk",
          variant: "secondary",
        },
      ]}
      stats={[
        { label: translateText("Appointments Today"), value: data?.appointmentsToday ?? "—", note: translateText("Front-desk workload") },
        { label: translateText("Patients Total"), value: data?.patientsTotal ?? "—", note: translateText("Check-in scope") },
        { label: translateText("Unread Notifications"), value: data?.unreadNotifications ?? "—", note: translateText("Requires follow-up") },
        { label: translateText("My Pending Requests"), value: data?.myPendingRequests ?? "—", note: translateText("Open staff requests") },
      ]}
      brief={{
        kicker: translateText("Daily brief"),
        title: translateText("What the front desk should move first"),
        body: translateText("Start with bookings, incoming patients, and transfer arrivals that need quick handoff coordination."),
        items: [
          { label: translateText("Appointments Today"), value: data?.appointmentsToday ?? "—" },
          { label: translateText("Unread Notifications"), value: data?.unreadNotifications ?? "—", tone: Number(data?.unreadNotifications || 0) > 0 ? "warn" : "good" },
          { label: translateText("Pending transfers"), value: transfers.filter((t) => t.status === "Pending").length, tone: transfers.some((t) => t.status === "Pending") ? "warn" : "good" },
        ],
      }}
      runway={[
        { id: "reception-runway-booking", title: translateText("Fast hospital booking"), description: translateText("Open the main booking flow and keep patient arrivals moving without delay."), eyebrow: translateText("Booking"), path: "/receptionist/booking-desk", badge: translateText("Live") },
        { id: "reception-runway-messages", title: translateText("Front desk messages"), description: translateText("Check notifications, service updates, and request follow-up in one place."), eyebrow: translateText("Messages"), path: "/notifications", badge: `${data?.unreadNotifications ?? 0}` },
        { id: "reception-runway-transfers", title: translateText("Transfer continuity"), description: translateText("Review transfer arrivals and handoff status before patients hit the desk."), eyebrow: translateText("Continuity"), path: "/hospital-admin/transfer-command-center", badge: `${transfers.filter((t) => t.status === "Pending").length}` },
        { id: "reception-runway-requests", title: translateText("My requests"), description: translateText("Open your leave and staffing requests without leaving the workspace shell."), eyebrow: translateText("Requests"), path: "/workforce/requests", badge: `${data?.myPendingRequests ?? 0}` },
      ]}
      pinnedTools={[
        { id: "reception-tool-booking", title: translateText("Booking Desk"), description: translateText("Keep the main patient arrival and scheduling desk close."), eyebrow: translateText("Pinned"), path: "/receptionist/booking-desk", variant: "compact" },
        { id: "reception-tool-notifications", title: translateText("Notifications"), description: translateText("Return to updates and patient-facing messages quickly."), eyebrow: translateText("Pinned"), path: "/notifications", variant: "compact" },
        { id: "reception-tool-transfers", title: translateText("Transfer Command Center"), description: translateText("Open continuity handoff workflows when arrivals need routing support."), eyebrow: translateText("Pinned"), path: "/hospital-admin/transfer-command-center", variant: "compact" },
      ]}
      recentItems={[
        { id: "reception-recent-booking", title: translateText("Booking workflow"), description: translateText("Re-open the desk you were using most recently."), eyebrow: translateText("Recent"), path: "/receptionist/booking-desk", variant: "compact" },
        { id: "reception-recent-messages", title: translateText("Front desk messages"), description: translateText("Jump back into the last messages and notifications you reviewed."), eyebrow: translateText("Recent"), path: "/notifications", variant: "compact" },
      ]}
      savedViews={[
        { id: "reception-saved-pending", title: translateText("Pending handoffs"), description: translateText("Saved view for transfer arrivals and waiting continuity actions."), eyebrow: translateText("Saved view"), path: "/hospital-admin/transfer-command-center", variant: "compact" },
      ]}
      contextCards={[
        {
          title: translateText("Front desk context"),
          subtitle: translateText("The signals most likely to shape the next arrivals."),
          items: [
            { label: translateText("Patients Total"), value: data?.patientsTotal ?? "—" },
            { label: translateText("Unread Notifications"), value: data?.unreadNotifications ?? "—", tone: Number(data?.unreadNotifications || 0) > 0 ? "warn" : "good" },
            { label: translateText("Pending transfers"), value: transfers.filter((t) => t.status === "Pending").length, tone: transfers.some((t) => t.status === "Pending") ? "warn" : "good" },
          ],
          actions: [
            { label: translateText("Booking Desk"), path: "/receptionist/booking-desk", variant: "secondary" },
            { label: translateText("Notifications"), path: "/notifications", variant: "secondary" },
          ],
        },
      ]}
    >
      <DashboardSection title={translateText("Front Desk Summary")} subtitle={translateText("The core booking and check-in signals at a glance.")}>
        <div className="grid info-grid">
          <StatCard title={translateText("Appointments Today")} value={data?.appointmentsToday ?? "—"} onClick={() => navigate("/receptionist/booking-desk")} />
          <StatCard title={translateText("Patients Total")} value={data?.patientsTotal ?? "—"} onClick={() => navigate("/receptionist/booking-desk")} />
          <StatCard title={translateText("Unread Notifications")} value={data?.unreadNotifications ?? "—"} onClick={() => navigate("/notifications")} />
          <StatCard title={translateText("My Pending Requests")} value={data?.myPendingRequests ?? "—"} onClick={() => navigate("/workforce/requests")} />
        </div>
      </DashboardSection>

      <DashboardSection title={translateText("Main Tasks")} subtitle={translateText("Open the key front-desk workflows without context switching.")}>
        <div className="panel-grid">
          <button
            type="button"
            className="action-link"
            onClick={() => navigate("/receptionist/booking-desk")}
            data-ai-action="open-booking-desk"
            data-ai-label="Open Fast Hospital Booking"
            data-ai-aliases="fast booking|front desk booking|booking task"
            data-ai-help="Navigate to the fast hospital booking workflow."
          >
            {translateText("Fast Hospital Booking")}
          </button>
          <button
            type="button"
            className="action-link"
            onClick={() => navigate("/notifications")}
            data-ai-action="open-front-desk-messages"
            data-ai-label="Open Front Desk Messages"
            data-ai-aliases="notifications|messages|front desk inbox"
            data-ai-help="Navigate to receptionist notifications and messages."
          >
            {translateText("Front Desk Messages")}
          </button>
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
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate("/hospital-admin/transfer-command-center")}
              data-ai-action="open-transfer-command-center"
              data-ai-label="Open Transfer Command Center"
              data-ai-aliases="transfer command center|handover desk|transfer workflow"
              data-ai-help="Navigate to the transfer command center for hospital handoffs."
            >
              {translateText("Transfer Command Center")}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate("/receptionist/booking-desk")}
              data-ai-action="open-booking-desk"
              data-ai-label="Open Booking Desk"
              data-ai-aliases="booking desk|front desk booking|booking workflow"
              data-ai-help="Navigate to the receptionist booking desk workflow."
            >
              {translateText("Booking Desk")}
            </button>
          </div>
        </div>
        <div className="card doctor-alerts-card">
          <h3>{translateText("Continuity Actions")}</h3>
          <div className="alert-stack">
            <div className="alert-item">{translateText("Confirm receiving hospital details before check-in.")}</div>
            <div className="alert-item">{translateText("Direct patients to transfer handover desk if pending.")}</div>
            <div className="alert-item">{translateText("Notify clinicians when transfer arrivals are on-site.")}</div>
          </div>
        </div>
      </DashboardSection>
    </DashboardHomeShell>
  );
}
