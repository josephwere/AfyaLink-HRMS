export function settingsPathForRole(role) {
  if (["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role)) return "/super-admin/settings";
  if (["HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT"].includes(role)) return "/hospital-admin/customization";
  return "/profile";
}

export function getQuickActionsForRole(role) {
  const common = [
    { label: "Open Reports", path: "/reports", icon: "reports" },
    { label: "View Notifications", path: "/notifications", icon: "notifications" },
  ];

  const roleActions = {
    SUPER_ADMIN: [
      { label: "Super Admin Dashboard", path: "/super-admin", icon: "home" },
      { label: "System Settings", path: "/super-admin/settings", icon: "settings" },
      { label: "Unified Assistant", path: "/system-admin/unified-assistant", icon: "ai" },
      { label: "Manage Hospitals", path: "/super-admin/hospitals", icon: "admin" },
    ],
    SYSTEM_ADMIN: [
      { label: "System Dashboard", path: "/system-admin", icon: "home" },
      { label: "Unified Assistant", path: "/system-admin/unified-assistant", icon: "ai" },
      { label: "Integration Hub", path: "/system-admin/integration-hub", icon: "settings" },
      { label: "Compliance Center", path: "/system-admin/compliance-center", icon: "shield" },
    ],
    HOSPITAL_ADMIN: [
      { label: "Hospital Overview", path: "/hospital-admin", icon: "home" },
      { label: "Staff Directory", path: "/hospital-admin/staff", icon: "staff" },
      { label: "Transfer Command Center", path: "/hospital-admin/transfer-command-center", icon: "requests" },
      { label: "Revenue Intelligence", path: "/hospital-admin/revenue-intelligence", icon: "analytics" },
    ],
    HOSPITAL_ADMIN_ASSISTANT: [
      { label: "Hospital Overview", path: "/hospital-admin", icon: "home" },
      { label: "Ward Board", path: "/hospital-admin/ward-board", icon: "analytics" },
      { label: "Approvals", path: "/hospital-admin/approvals", icon: "notifications" },
    ],
    HR_MANAGER: [
      { label: "HR Dashboard", path: "/hr-manager", icon: "home" },
      { label: "Training Tracker", path: "/admin/training-tracker", icon: "analytics" },
      { label: "Register Staff", path: "/hospital-admin/register-staff", icon: "hr" },
    ],
    PAYROLL_OFFICER: [
      { label: "Payroll Dashboard", path: "/payroll-officer", icon: "home" },
      { label: "Payment Operations", path: "/payments/full", icon: "payroll" },
    ],
    DEVELOPER: [
      { label: "Developer Console", path: "/developer", icon: "settings" },
      { label: "Queue Replay", path: "/developer/queue-replay", icon: "settings" },
      { label: "Decision Cockpit", path: "/developer/decision-cockpit", icon: "analytics" },
    ],
    DOCTOR: [
      { label: "Doctor Dashboard", path: "/doctor", icon: "home" },
      { label: "My Schedule", path: "/doctor/schedule", icon: "appointments" },
      { label: "OPD Clinic", path: "/doctor/opd", icon: "doctor" },
      { label: "Clinical Order Copilot", path: "/doctor/clinical-order-copilot", icon: "ai" },
    ],
    NURSE: [
      { label: "Nurse Dashboard", path: "/nurse", icon: "home" },
      { label: "My Shift", path: "/nurse/shift", icon: "nurse" },
      { label: "Assigned Patients", path: "/nurse/patients", icon: "staff" },
    ],
    LAB_TECH: [
      { label: "Lab Dashboard", path: "/lab-tech", icon: "home" },
      { label: "Test Queue", path: "/lab-tech/test-queue", icon: "lab" },
    ],
    PHARMACIST: [
      { label: "Pharmacy Dashboard", path: "/pharmacy", icon: "home" },
      { label: "Prescription Queue", path: "/pharmacy/queue", icon: "pharmacy" },
    ],
    COMMUNITY_HEALTH_WORKER: [
      { label: "CHW Dashboard", path: "/community-health-worker", icon: "home" },
      { label: "Referrals", path: "/community-health-worker", icon: "reports" },
    ],
    RECEPTIONIST: [
      { label: "Reception Dashboard", path: "/receptionist", icon: "home" },
      { label: "Booking Desk", path: "/receptionist/booking-desk", icon: "appointments" },
    ],
    PATIENT: [
      { label: "Patient Dashboard", path: "/patient", icon: "home" },
      { label: "My Appointments", path: "/patient/appointments", icon: "appointments" },
      { label: "Family Records", path: "/patient/family-records", icon: "staff" },
      { label: "Billing", path: "/patient/billing", icon: "payments" },
    ],
  };

  return [...(roleActions[role] || []), ...common];
}
