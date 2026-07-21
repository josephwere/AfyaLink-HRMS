import React, { useMemo } from "react";
import DashboardHomeShell, { DashboardSection } from "../../components/DashboardHomeShell";
import { useStaffDashboard } from "../../hooks/useStaffDashboard";
import { useAppLanguage } from "../../utils/appLanguage.jsx";

export default function StaffDashboard() {
  const { translateText } = useAppLanguage();
  const { data, transfers, transferError, role } = useStaffDashboard();

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

  const sectionConfigs = useMemo(
    () => [
      {
        id: "role-workspace",
        title: translateText("Role Workspace"),
        subtitle: translateText("Common tools and surfaces for this role."),
        widget: "list",
        props: {
          items: rolePanels.map((panel) => translateText(panel)),
        },
      },
      {
        id: "transfer-continuity",
        title: translateText("Transfer Continuity"),
        subtitle: translateText("Recent transfers and handoff status."),
        widget: "table",
        props: {
          columns: [
            { key: "patient", label: translateText("Patient") },
            { key: "route", label: translateText("Route") },
            { key: "status", label: translateText("Status") },
          ],
          rows: transfers.map((t) => ({
            key: t._id,
            cells: [
              `${t?.patient?.firstName || ""} ${t?.patient?.lastName || ""}`.trim(),
              `${t?.fromHospital?.name || t?.fromHospital?.code || "—"} → ${t?.toHospital?.name || t?.toHospital?.code || "—"}`,
              translateText(t.status),
            ],
          })),
          emptyMessage: transferError || translateText("No transfers yet."),
        },
      },
    ],
    [rolePanels, transferError, transfers, translateText]
  );

  const layout = useMemo(
    () => ({
      primary: ["role-workspace"],
      secondary: ["transfer-continuity"],
    }),
    []
  );

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
      sectionConfigs={sectionConfigs}
      layout={layout}
    />
  );
}

