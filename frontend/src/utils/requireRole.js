import { normalizeRole } from "./normalizeRole";

/**
 * Frontend mirror of backend requireRole(...)
 * Usage: requireRole(user, "ADMIN", "DOCTOR")
 */
export function requireRole(user, ...allowedRoles) {
  if (!user) {
    return {
      allowed: false,
      reason: "UNAUTHENTICATED",
    };
  }

  // If no roles are specified, this is auth-only protection.
  if (!allowedRoles.length) {
    return { allowed: true };
  }

  const userRole = normalizeRole(user.role);
  const allowed = allowedRoles.map((role) => normalizeRole(role));

  if (["SUPER_ADMIN", "DEVELOPER"].includes(userRole)) {
    return { allowed: true };
  }

  if (!allowed.includes(userRole)) {
    return {
      allowed: false,
      reason: "FORBIDDEN",
    };
  }

  return { allowed: true };
}
