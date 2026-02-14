const ROLE_ALIASES = Object.freeze({
  SUPERADMIN: "SUPER_ADMIN",
  SUPER_ADMIN: "SUPER_ADMIN",
  HOSPITALADMIN: "HOSPITAL_ADMIN",
  HOSPITAL_ADMIN: "HOSPITAL_ADMIN",
  DOCTOR: "DOCTOR",
  NURSE: "NURSE",
  LABTECH: "LAB_TECH",
  LAB_TECH: "LAB_TECH",
  PHARMACIST: "PHARMACIST",
  SECURITYOFFICER: "SECURITY_OFFICER",
  SECURITY_OFFICER: "SECURITY_OFFICER",
  SECURITYADMIN: "SECURITY_ADMIN",
  SECURITY_ADMIN: "SECURITY_ADMIN",
  PATIENT: "PATIENT",
  GUEST: "GUEST",
});

export function normalizeRole(role) {
  if (typeof role !== "string") return "";

  const normalized = role.trim().replace(/[\s-]+/g, "_").toUpperCase();
  const compact = normalized.replaceAll("_", "");

  return ROLE_ALIASES[normalized] || ROLE_ALIASES[compact] || normalized;
}

