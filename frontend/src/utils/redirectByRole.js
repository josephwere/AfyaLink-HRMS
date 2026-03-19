import { normalizeRole } from "./normalizeRole";

/**
 * Frontend role → landing route
 * MUST stay aligned with backend role enum + requireRole()
 */

const ROLE_REDIRECT_MAP = Object.freeze({
  // 🔑 Super & system admins
  SUPER_ADMIN: "/super-admin",
  SUPER_ASSISTANT: "/system-admin/unified-assistant",
  SYSTEM_ADMIN: "/system-admin",
  HOSPITAL_ADMIN: "/hospital-admin",
  HOSPITAL_ADMIN_ASSISTANT: "/hospital-admin",
  SECURITY_ADMIN: "/security-admin",
  SECURITY_OFFICER: "/security-officer",
  HR_MANAGER: "/hr-manager",
  PAYROLL_OFFICER: "/payroll-officer",
  COMMUNITY_HEALTH_WORKER: "/community-health-worker",
  GOVERNMENT_REGULATOR: "/system-admin/government-claims",
  GOVERNMENT_ADMIN: "/system-admin/government-claims",
  GOVERNMENT_AUDITOR: "/system-admin/government-claims",
  GOVERNMENT_INSPECTOR: "/system-admin/government-claims",
  GOVERNMENT_ANALYST: "/system-admin/government-claims",
  DEVELOPER: "/developer",

  // 🩺 Clinical staff
  DOCTOR: "/doctor",
  SURGEON: "/surgeon",
  NURSE: "/nurse",
  LAB_TECH: "/lab-tech",
  PHARMACIST: "/pharmacy",

  // 👤 End users
  PATIENT: "/patient",
  GUEST: "/guest",

  // 🚨 future-proof (backend may add later)
  RADIOLOGIST: "/radiologist",
  THERAPIST: "/therapist",
  RECEPTIONIST: "/receptionist",
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
