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

  SECURITY_ADMIN: "/app/platform/home/index",
  SECURITY_OFFICER: "/app/platform/home/index",

  // 🏥 Facility ops
  HOSPITAL_ADMIN: "/app/operations/home/index",
  HOSPITAL_ADMIN_ASSISTANT: "/app/operations/home/index",
  RECEPTIONIST: "/app/operations/home/index",
  COMMUNITY_HEALTH_WORKER: "/app/operations/home/index",
  LAB_TECH: "/app/operations/home/index",
  PHARMACIST: "/app/operations/home/index",

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

/**
 * Redirect user to correct home by role
 * @param {object} user
 * @returns {string}
 */
export const redirectByRole = (user) => {
  if (!user?.role) return "/login";
  const role = normalizeRole(user.role);

  return ROLE_REDIRECT_MAP[role] || "/unauthorized";
};
