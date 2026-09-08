import { normalizeRole } from "../utils/normalizeRole.js";
import logger from "../utils/logger.js";

const ROLE_OVERRIDE_ALLOWED_FOR = new Set(["SUPER_ADMIN"]);

const VIEWABLE_ROLES = new Set([
  "SUPER_ADMIN",
  "SUPER_ASSISTANT",
  "SYSTEM_ADMIN",
  "HOSPITAL_ADMIN",
  "HOSPITAL_ADMIN_ASSISTANT",
  "DEVELOPER",
  "DOCTOR",
  "SURGEON",
  "NURSE",
  "LAB_TECH",
  "PHARMACIST",
  "RADIOLOGIST",
  "THERAPIST",
  "RECEPTIONIST",
  "SECURITY_OFFICER",
  "SECURITY_ADMIN",
  "HR_MANAGER",
  "PAYROLL_OFFICER",
  "ACCOUNTANT",
  "FINANCE_MANAGER",
  "CFO",
  "COMMUNITY_HEALTH_WORKER",
  "GOVERNMENT_REGULATOR",
  "GOVERNMENT_AUDITOR",
  "GOVERNMENT_ADMIN",
  "GOVERNMENT_INSPECTOR",
  "GOVERNMENT_ANALYST",
  "PATIENT",
  "GUEST",
  "DRIVER",
  "AMBULANCE_DRIVER",
  "MORTUARY_STAFF",
  "MORTUARY_MANAGER",
]);

export function resolveEffectiveRole(req, actualRole) {
  const normalizedActual = normalizeRole(actualRole || "");
  const requested =
    req.headers["x-afya-view-role"] ||
    req.headers["x-afyalink-view-role"] ||
    req.query?.viewRole ||
    "";
  const normalizedRequested = normalizeRole(requested);

  const effectiveRole = (() => {
    if (!ROLE_OVERRIDE_ALLOWED_FOR.has(normalizedActual)) {
      return normalizedActual;
    }
    if (!normalizedRequested || !VIEWABLE_ROLES.has(normalizedRequested)) {
      return normalizedActual;
    }
    return normalizedRequested;
  })();

  if (effectiveRole !== normalizedActual) {
    logger.info(
      "ROLE_OVERRIDE",
      {
        userId: req.user?._id || req.user?.id || null,
        actualRole: normalizedActual,
        effectiveRole,
        requestedRole: normalizedRequested,
        path: req.originalUrl || req.url,
        method: req.method,
        ip: req.ip,
      }
    );
  }

  return effectiveRole;
}
