export function settingsPathForRole(role) {
  if (["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role)) return "/app/platform/settings/system";
  if (["HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT"].includes(role)) return "/app/platform/facility/customization";
  return "/app/platform/account/profile";
}

export function getQuickActionsForRole(role) {
  const common = [
    { label: "Open Reports", path: "/app/platform/reports/index", icon: "reports" },
    { label: "View Notifications", path: "/app/platform/inbox/notifications", icon: "notifications" },
  ];

  const roleActions = {
    SUPER_ADMIN: [
      { label: "Platform Home", path: "/app/platform/home/index", icon: "home" },
      { label: "System Settings", path: "/app/platform/settings/system", icon: "settings" },
      { label: "Unified Assistant", path: "/app/platform/ai/unified-assistant", icon: "ai" },
      { label: "Hospital Registry", path: "/app/governance/registry/hospitals", icon: "admin" },
    ],
    SYSTEM_ADMIN: [
      { label: "Governance Home", path: "/app/governance/home/index", icon: "home" },
      { label: "Unified Assistant", path: "/app/platform/ai/unified-assistant", icon: "ai" },
      { label: "Integration Hub", path: "/app/platform/integrations/hub", icon: "settings" },
      { label: "Compliance Center", path: "/app/platform/compliance/center", icon: "shield" },
    ],
    HOSPITAL_ADMIN: [
      { label: "Operations Home", path: "/app/operations/home/index", icon: "home" },
      { label: "Staff Directory", path: "/app/people/staff/index", icon: "staff" },
      { label: "Transfer Command", path: "/app/operations/transfers/command", icon: "requests" },
      { label: "Revenue Intelligence", path: "/app/revenue/intelligence/index", icon: "analytics" },
    ],
    HOSPITAL_ADMIN_ASSISTANT: [
      { label: "Operations Home", path: "/app/operations/home/index", icon: "home" },
      { label: "Bed Board", path: "/app/operations/bed-board/index", icon: "analytics" },
      { label: "Approvals", path: "/app/people/approvals/index", icon: "notifications" },
    ],
    HR_MANAGER: [
      { label: "People Home", path: "/app/people/home/index", icon: "home" },
      { label: "Training Tracker", path: "/app/people/training/tracker", icon: "analytics" },
      { label: "Register Staff", path: "/app/people/staff/register", icon: "hr" },
    ],
    PAYROLL_OFFICER: [
      { label: "Revenue Home", path: "/app/revenue/home/index", icon: "home" },
      { label: "Payment Operations", path: "/app/revenue/payments/index", icon: "payroll" },
    ],
    DEVELOPER: [
      { label: "Developer Console", path: "/app/platform/dev/home", icon: "settings" },
      { label: "Queue Replay", path: "/app/platform/queues/replay", icon: "settings" },
      { label: "Decision Cockpit", path: "/app/platform/trust/decision-cockpit", icon: "analytics" },
    ],
    DOCTOR: [
      { label: "Care Home", path: "/app/care/home/index", icon: "home" },
      { label: "My Schedule", path: "/app/operations/scheduling/my-schedule", icon: "appointments" },
      { label: "OPD Workspace", path: "/app/care/encounters/opd", icon: "doctor" },
      { label: "Clinical Order Copilot", path: "/app/innovation/copilot/clinical-order", icon: "ai" },
    ],
    NURSE: [
      { label: "Care Home", path: "/app/care/home/index", icon: "home" },
      { label: "My Shift", path: "/app/people/schedule/shift", icon: "nurse" },
      { label: "Assigned Patients", path: "/app/care/patients/index", icon: "staff" },
    ],
    LAB_TECH: [
      { label: "Operations Home", path: "/app/operations/home/index", icon: "home" },
      { label: "Test Queue", path: "/app/operations/lab/test-queue", icon: "lab" },
    ],
    PHARMACIST: [
      { label: "Operations Home", path: "/app/operations/home/index", icon: "home" },
      { label: "Prescription Queue", path: "/app/operations/pharmacy/prescription-queue", icon: "pharmacy" },
    ],
    COMMUNITY_HEALTH_WORKER: [
      { label: "Operations Home", path: "/app/operations/home/index", icon: "home" },
      { label: "Referrals", path: "/app/care/referrals/index", icon: "reports" },
    ],
    RECEPTIONIST: [
      { label: "Operations Home", path: "/app/operations/home/index", icon: "home" },
      { label: "Booking Desk", path: "/app/operations/front-desk/booking-desk", icon: "appointments" },
    ],
    PATIENT: [
      { label: "Portal Home", path: "/app/portal/home/index", icon: "home" },
      { label: "My Appointments", path: "/app/portal/appointments/index", icon: "appointments" },
      { label: "Family Records", path: "/app/portal/family/records", icon: "staff" },
      { label: "Billing", path: "/app/portal/billing/index", icon: "payments" },
    ],
  };

  return [...(roleActions[role] || []), ...common];
}
