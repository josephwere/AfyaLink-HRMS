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
  const actualRole = normalizeRole(user.actualRole);
  const strictImpersonation =
    typeof window !== "undefined" &&
    window.localStorage?.getItem("strict_impersonation") === "1";
  const allowed = allowedRoles.map((role) => normalizeRole(role));

  // Founder/developer must retain full platform access even while switched to another role.
  if (!strictImpersonation && ["SUPER_ADMIN", "DEVELOPER"].includes(actualRole)) {
    return { allowed: true };
  }

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
