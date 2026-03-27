import React, { useEffect, useMemo, useState } from "react";
import DashboardHomeShell, { DashboardSection } from "../../components/DashboardHomeShell";
import { useAuth } from "../../utils/auth";
import { getStaffDashboard } from "../../services/dashboardApi";
import { listTransfers } from "../../services/transferApi";
import { useAppLanguage } from "../../utils/appLanguage.jsx";

export default function StaffDashboard() {
  const { user } = useAuth();
  const { translateText } = useAppLanguage();
  const [data, setData] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");

  useEffect(() => {
    getStaffDashboard().then(setData).catch(() => setData(null));
  }, []);

  useEffect(() => {
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

  const role = useMemo(() => String(user?.role || "").toUpperCase(), [user?.role]);

  const roleTitle =
    role === "RADIOLOGIST"
      ? translateText("Radiologist Workspace")
      : role === "THERAPIST"
      ? translateText("Therapist Workspace")
      : role === "RECEPTIONIST"
      ? translateText("Receptionist Workspace")
      : translateText("Staff Workspace");

  const rolePanels =
    role === "RADIOLOGIST"
      ? ["Imaging Queue", "Scan Viewer", "Report Editor", "Equipment Logs", "AI Assistance Overlay"]
      : role === "THERAPIST"
      ? ["Session Schedule", "Patient Notes", "Treatment Plans", "Progress Tracking", "Follow-up Planner"]
      : ["Appointment Scheduling", "Patient Check-In", "Billing Initiation", "Queue Management", "Visitor Log"];

  const roleWorkspacePath =
    role === "RADIOLOGIST"
      ? "/app/operations/units/imaging"
      : role === "THERAPIST"
      ? "/app/operations/scheduling/appointments"
      : role === "RECEPTIONIST"
      ? "/app/operations/front-desk/booking-desk"
      : "/app/people/requests/index";

  return (
    <DashboardHomeShell
      shellKey={`staff_${role || "workspace"}`}
      kicker={translateText("Operations")}
      title={roleTitle}
      subtitle={translateText("Requests, queues, and alerts for your role, without clutter.")}
      actions={[
        { label: translateText("Open Role Workspace"), path: roleWorkspacePath },
        { label: translateText("My Requests"), path: "/app/people/requests/index", variant: "secondary" },
        { label: translateText("Notifications"), path: "/app/platform/inbox/notifications", variant: "secondary" },
      ]}
      stats={[
        { label: translateText("My Pending Requests"), value: data?.myPendingRequests ?? "—", path: "/app/people/requests/index" },
        { label: translateText("Hospital Pending Requests"), value: data?.hospitalPendingRequests ?? "—", path: "/app/people/requests/index" },
        { label: translateText("Unread Notifications"), value: data?.notificationsUnread ?? "—", path: "/app/platform/inbox/notifications" },
        { label: translateText("Appointments Today"), value: data?.appointmentsToday ?? "—", path: roleWorkspacePath },
      ]}
    >
      <DashboardSection title={translateText("Role Workspace")} subtitle={translateText("Common tools and surfaces for this role.")}>
        <ul className="muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
          {rolePanels.map((p) => (
            <li key={p}>{translateText(p)}</li>
          ))}
        </ul>
      </DashboardSection>

      <DashboardSection title={translateText("Transfer Continuity")} subtitle={translateText("Recent transfers and handoff status.")}>
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
    </DashboardHomeShell>
  );
}

