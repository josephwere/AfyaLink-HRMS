import { normalizeRole } from "../utils/normalizeRole.js";

const OVERRIDE_ROLES = new Set(["SUPER_ADMIN", "DEVELOPER"]);

function resolveActualRole(req) {
  return normalizeRole(req.user?.actualRole || req.user?.role || "");
}

export function isPrivilegedOverrideAllowed(req) {
  const role = resolveActualRole(req);
  return OVERRIDE_ROLES.has(role);
}

export function isReadOnlyOverrideAllowed(req) {
  return isPrivilegedOverrideAllowed(req);
}
