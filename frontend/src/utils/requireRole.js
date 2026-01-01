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

  if (!allowedRoles.includes(user.role)) {
    return {
      allowed: false,
      reason: "FORBIDDEN",
    };
  }

  return { allowed: true };
}
