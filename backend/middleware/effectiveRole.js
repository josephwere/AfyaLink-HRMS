import { normalizeRole } from "../utils/normalizeRole.js";

const ROLE_OVERRIDE_ALLOWED_FOR = new Set(["SUPER_ADMIN", "DEVELOPER"]);

const VIEWABLE_ROLES = new Set([
  "SUPER_ADMIN",
  "SYSTEM_ADMIN",
  "HOSPITAL_ADMIN",
  "DEVELOPER",
  "DOCTOR",
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
  "PATIENT",
  "GUEST",
]);

export function resolveEffectiveRole(req, actualRole) {
  const normalizedActual = normalizeRole(actualRole || "");
  const requested =
    req.headers["x-afya-view-role"] ||
    req.headers["x-afyalink-view-role"] ||
    req.query?.viewRole ||
    "";
  const normalizedRequested = normalizeRole(requested);

  if (!ROLE_OVERRIDE_ALLOWED_FOR.has(normalizedActual)) {
    return normalizedActual;
  }
  if (!normalizedRequested || !VIEWABLE_ROLES.has(normalizedRequested)) {
    return normalizedActual;
  }
  return normalizedRequested;
}

