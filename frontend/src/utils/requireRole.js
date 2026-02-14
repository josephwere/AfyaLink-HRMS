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

  const userRole = normalizeRole(user.role);
  const allowed = allowedRoles.map((role) => normalizeRole(role));

  if (!allowed.includes(userRole)) {
    return {
      allowed: false,
      reason: "FORBIDDEN",
    };
  }

  return { allowed: true };
}
