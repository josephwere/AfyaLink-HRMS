const HUMAN_ACCOUNT_ROLES = new Set([
  "PATIENT",
  "GUEST",
  "DOCTOR",
  "SURGEON",
  "NURSE",
  "RADIOLOGIST",
  "THERAPIST",
  "LAB_TECH",
  "PHARMACIST",
  "RECEPTIONIST",
  "HOSPITAL_ADMIN",
  "HOSPITAL_ADMIN_ASSISTANT",
  "SUPER_ADMIN",
  "SYSTEM_ADMIN",
  "DEVELOPER",
  "HR_MANAGER",
  "PAYROLL_OFFICER",
  "SECURITY_ADMIN",
  "SECURITY_OFFICER",
  "GOVERNMENT_ADMIN",
  "GOVERNMENT_REGULATOR",
  "GOVERNMENT_AUDITOR",
  "GOVERNMENT_INSPECTOR",
  "GOVERNMENT_ANALYST",
  "COMMUNITY_HEALTH_WORKER",
  "DRIVER",
  "AMBULANCE_DRIVER",
  "MORTUARY_STAFF",
  "MORTUARY_MANAGER",
  "SUPER_ASSISTANT",
]);

const PATIENT_CONTEXT_ROLES = new Set(["PATIENT", "GUEST"]);

function normalizeRole(value) {
  return String(value || "").trim().toUpperCase();
}

export function canUseMyHealthContext(user = null) {
  if (!user) return false;
  if (user.isServiceAccount || user.isBotAccount || user.isAutomationAccount || user.isSystemAccount) return false;
  if (user.accountType) {
    const accountType = String(user.accountType).trim().toLowerCase();
    if (["service", "system", "automation", "bot", "monitoring", "worker", "scheduler"].includes(accountType)) return false;
  }
  const role = normalizeRole(user.role || user.actualRole || user.currentRole || "");
  return HUMAN_ACCOUNT_ROLES.has(role);
}

export function isPatientContextUser(user = null) {
  const role = normalizeRole(user?.role || user?.actualRole || user?.currentRole || "");
  return PATIENT_CONTEXT_ROLES.has(role);
}

export function getDefaultContextMode(user = null) {
  if (isPatientContextUser(user)) return "MY_HEALTH";
  return canUseMyHealthContext(user) ? "WORK" : "WORK";
}

export function getContextModeLabel(mode) {
  return mode === "MY_HEALTH" ? "My Health" : "Work";
}
