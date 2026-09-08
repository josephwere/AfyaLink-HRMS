import { normalizeRole } from "./normalizeRole";

const ROLE_PRIORITY = Object.freeze({
  SUPER_ADMIN: 100,
  SUPER_ASSISTANT: 95,
  SYSTEM_ADMIN: 90,
  HOSPITAL_ADMIN: 80,
  HOSPITAL_ADMIN_ASSISTANT: 70,
  DOCTOR: 60,
  SURGEON: 60,
  NURSE: 60,
  LAB_TECH: 60,
  PHARMACIST: 60,
  SUPPLIER: 60,
  RADIOLOGIST: 60,
  THERAPIST: 60,
  RECEPTIONIST: 60,
  SECURITY_ADMIN: 60,
  SECURITY_OFFICER: 60,
  HR_MANAGER: 60,
  PAYROLL_OFFICER: 60,
  COMMUNITY_HEALTH_WORKER: 50,
  DEVELOPER: 30,
  GOVERNMENT_ADMIN: 5,
  GOVERNMENT_REGULATOR: 5,
  GOVERNMENT_AUDITOR: 5,
  GOVERNMENT_INSPECTOR: 5,
  GOVERNMENT_ANALYST: 5,
  PATIENT: 10,
  GUEST: 0,
});

function hasHierarchicalAccess(userRole, allowedRoles) {
  const userPriority = ROLE_PRIORITY[userRole] ?? 0;
  return allowedRoles.some((role) => userPriority >= (ROLE_PRIORITY[role] ?? 0));
}

/**
 * Frontend mirror of backend requireRole(...)
 * Usage: requireRole(user, "HOSPITAL_ADMIN", "DOCTOR")
 */
export function requireRole(user, ...allowedRoles) {
  if (!user) {
    return {
      allowed: false,
      reason: "UNAUTHENTICATED",
    };
  }

  if (!allowedRoles.length) {
    return { allowed: true };
  }

  const userRole = normalizeRole(user.role);
  const actualRole = normalizeRole(user.actualRole);
  const strictImpersonation =
    typeof window !== "undefined" &&
    window.localStorage?.getItem("strict_impersonation") === "1";
  const allowed = allowedRoles.map((role) => normalizeRole(role)).filter(Boolean);

  // Founder/developer must retain full platform access even while switched.
  if (!strictImpersonation && ["SUPER_ADMIN", "DEVELOPER"].includes(actualRole)) {
    return { allowed: true };
  }

  if (["SUPER_ADMIN", "DEVELOPER"].includes(userRole)) {
    return { allowed: true };
  }

  // Route guards must match backend requireRole semantics: exact membership.
  // Priority checks caused lower numeric roles like DEVELOPER to accidentally
  // make clinical roles appear authorized for platform-only routes.
  if (!allowed.includes(userRole)) {
    return {
      allowed: false,
      reason: "FORBIDDEN",
    };
  }

  return { allowed: true };
}

export function hasRoleAccess(userRole, ...allowedRoles) {
  return hasHierarchicalAccess(
    normalizeRole(userRole),
    allowedRoles.map((role) => normalizeRole(role)).filter(Boolean)
  );
}
