import { normalizeRole } from "./normalizeRole";

/**
 * Frontend role → landing route
 * MUST stay aligned with backend role enum + requireRole()
 */

const ROLE_REDIRECT_MAP = Object.freeze({
  // 🔑 Platform operators
  SUPER_ADMIN: "/app/platform/home/index",
  SUPER_ASSISTANT: "/app/platform/ai/unified-assistant",
  SYSTEM_ADMIN: "/app/governance/home/index",
  DEVELOPER: "/app/platform/dev/home",

  SECURITY_ADMIN: "/app/platform/security/admin/home",
  SECURITY_OFFICER: "/app/platform/security/officer/home",

  // 🏥 Facility ops
  HOSPITAL_ADMIN: "/app/operations/home/index",
  HOSPITAL_ADMIN_ASSISTANT: "/app/operations/home/index",
  RECEPTIONIST: "/app/operations/home/index",
  COMMUNITY_HEALTH_WORKER: "/app/operations/home/index",
  LAB_TECH: "/app/operations/home/index",
  PHARMACIST: "/app/operations/home/index",
  DRIVER: "/app/operations/driver/home",
  AMBULANCE_DRIVER: "/app/operations/driver/home",
  MORTUARY_STAFF: "/app/operations/mortuary/home",
  MORTUARY_MANAGER: "/app/operations/mortuary/home",
  MAINTENANCE_TECH: "/app/operations/home/index",
  BIOMEDICAL_TECHNICIAN: "/app/operations/home/index",
  HOUSEKEEPING_STAFF: "/app/operations/home/index",
  KITCHEN_STAFF: "/app/operations/home/index",

  // 🩺 Care
  DOCTOR: "/app/care/home/index",
  SURGEON: "/app/care/home/index",
  NURSE: "/app/care/home/index",
  RADIOLOGIST: "/app/care/home/index",
  THERAPIST: "/app/care/home/index",

  // 👥 People + revenue
  HR_MANAGER: "/app/people/home/index",
  PAYROLL_OFFICER: "/app/revenue/home/index",

  // 🏛 Governance
  GOVERNMENT_REGULATOR: "/app/governance/home/index",
  GOVERNMENT_ADMIN: "/app/governance/home/index",
  GOVERNMENT_AUDITOR: "/app/governance/home/index",
  GOVERNMENT_INSPECTOR: "/app/governance/home/index",
  GOVERNMENT_ANALYST: "/app/governance/home/index",

  // 👤 Portal
  PATIENT: "/app/portal/home/index",
  GUEST: "/app/portal/home/index",
});

export const redirectByRole = (user, context) => {
  if (!user?.role) return "/login";
  const role = normalizeRole(user.role);

  // Resolve context: check parameter, fallback to default for role
  const resolvedContext = context || (role === "PATIENT" || role === "GUEST" ? "MY_HEALTH" : "WORK");

  if (resolvedContext === "MY_HEALTH") {
    // Service/system accounts never receive My Health access
    const isService = user.isServiceAccount || user.isBotAccount || user.isAutomationAccount || user.isSystemAccount;
    const accountType = user.accountType ? String(user.accountType).trim().toLowerCase() : "";
    const isServiceType = ["service", "system", "automation", "bot", "monitoring", "worker", "scheduler"].includes(accountType);

    if (!isService && !isServiceType) {
      const allowPortal = role === "PATIENT" || role === "GUEST";
      return allowPortal ? "/app/portal/home/index" : "/app/portal/appointments/index";
    }
  }

  return ROLE_REDIRECT_MAP[role] || "/unauthorized";
};
