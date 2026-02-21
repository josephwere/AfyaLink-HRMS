import { PERMISSIONS } from "../config/permissions.js";
import { normalizeRole } from "./normalizeRole.js";

/* ======================================================
   CENTRAL PERMISSION + ABAC ENFORCER (FINAL)
====================================================== */
export function hasPermission(user, resourceName, action, req) {
  if (!user) return false;

  // 👑 PLATFORM SUPER ADMIN (NO TENANT LIMITS)
  const actualRole = normalizeRole(user.actualRole || user.role);
  const userRole = normalizeRole(user.role);
  if (actualRole === "SUPER_ADMIN" || actualRole === "DEVELOPER") return true;

  const rolePerms = PERMISSIONS[userRole];
  if (!rolePerms) return false;

  const allowedActions =
    rolePerms[resourceName] || rolePerms["*"];

  if (!allowedActions) return false;

  if (
    allowedActions.includes("*") ||
    allowedActions.includes(action)
  ) {
    return enforceABAC(user, userRole, req?.resource, req);
  }

  return false;
}

/* ======================================================
   ABAC RULES (ZERO TRUST)
====================================================== */
function enforceABAC(user, userRole, resource, req) {
  // LIST endpoints (no single resource yet)
  if (!resource) return true;

  /* ---------------------------------------------
     1️⃣ OWNER-ONLY ACCESS (PATIENT DATA)
  --------------------------------------------- */
  if (
    resource.ownerId &&
    String(resource.ownerId) !== String(user.id)
  ) {
    return false;
  }

  /* ---------------------------------------------
     2️⃣ HOSPITAL ISOLATION (MULTI-TENANT WALL)
  --------------------------------------------- */
  if (
    resource.hospitalId &&
    user.hospital &&
    String(resource.hospitalId) !== String(user.hospital)
  ) {
    return false;
  }

  /* ---------------------------------------------
     3️⃣ DOCTOR ASSIGNMENT CHECK
  --------------------------------------------- */
  if (
    resource.doctorId &&
    userRole === "DOCTOR" &&
    String(resource.doctorId) !== String(user.id)
  ) {
    return false;
  }

  return true;
}
