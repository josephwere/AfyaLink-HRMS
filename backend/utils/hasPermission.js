import { PERMISSIONS } from "../config/permissions.js";

/* ======================================================
   CENTRAL PERMISSION + ABAC ENFORCER (FINAL)
====================================================== */
export function hasPermission(user, resourceName, action, req) {
  if (!user) return false;

  // 👑 PLATFORM SUPER ADMIN (NO TENANT LIMITS)
  if (user.role === "SuperAdmin") return true;

  const rolePerms = PERMISSIONS[user.role];
  if (!rolePerms) return false;

  const allowedActions =
    rolePerms[resourceName] || rolePerms["*"];

  if (!allowedActions) return false;

  if (
    allowedActions.includes("*") ||
    allowedActions.includes(action)
  ) {
    return enforceABAC(user, req?.resource, req);
  }

  return false;
}

/* ======================================================
   ABAC RULES (ZERO TRUST)
====================================================== */
function enforceABAC(user, resource, req) {
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
    user.role === "Doctor" &&
    String(resource.doctorId) !== String(user.id)
  ) {
    return false;
  }

  return true;
}
