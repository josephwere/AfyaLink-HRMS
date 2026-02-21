import { normalizeRole } from "./normalizeRole";

/**
 * Frontend role → landing route
 * MUST stay aligned with backend role enum + requireRole()
 */

const ROLE_REDIRECT_MAP = Object.freeze({
  // 🔑 Super & system admins
  SUPER_ADMIN: "/super-admin",
  SYSTEM_ADMIN: "/system-admin",
  HOSPITAL_ADMIN: "/hospital-admin",
  SECURITY_ADMIN: "/security-admin",
  SECURITY_OFFICER: "/security-officer",
  HR_MANAGER: "/hr-manager",
  PAYROLL_OFFICER: "/payroll-officer",
  COMMUNITY_HEALTH_WORKER: "/community-health-worker",
  DEVELOPER: "/developer",

  // 🩺 Clinical staff
  DOCTOR: "/doctor",
  NURSE: "/nurse",
  LAB_TECH: "/lab-tech",
  PHARMACIST: "/pharmacy",

  // 👤 End users
  PATIENT: "/patient",
  GUEST: "/guest",

  // 🚨 future-proof (backend may add later)
  RADIOLOGIST: "/staff",
  THERAPIST: "/staff",
  RECEPTIONIST: "/staff",
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
