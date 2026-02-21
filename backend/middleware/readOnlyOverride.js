import { normalizeRole } from "../utils/normalizeRole.js";

const OVERRIDE_ROLES = new Set(["SUPER_ADMIN", "DEVELOPER"]);

function resolveActualRole(req) {
  return normalizeRole(req.user?.actualRole || req.user?.role || "");
}

function isStrictImpersonation(req) {
  const header =
    req.headers["x-afya-strict-impersonation"] ||
    req.headers["x-afyalink-strict-impersonation"] ||
    req.query?.strictImpersonation ||
    "";
  const normalized = String(header).trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export function isPrivilegedOverrideAllowed(req) {
  if (isStrictImpersonation(req)) return false;
  const role = resolveActualRole(req);
  return OVERRIDE_ROLES.has(role);
}

export function isReadOnlyOverrideAllowed(req) {
  return isPrivilegedOverrideAllowed(req);
}
