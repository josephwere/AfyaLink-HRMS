const DEFAULT_FLAGS = {
  discovery: true,
  map: true,
  hospitalDrawer: true,
  doctorMarketplace: false,
  aiRecommendations: true,
};

const PATIENT_MODE_ROLES = new Set(["PATIENT", "GUEST"]);
const NON_PATIENT_CONTEXT_ROLES = new Set([
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

function normalizeRole(value) {
  if (!value) return "";
  return String(value).trim().toUpperCase();
}

function parseFlag(value, fallback = true) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
  }
  return fallback;
}

export function getPatientAppointmentFeatureFlags(env = {}) {
  return {
    discovery: parseFlag(env?.VITE_PATIENT_DISCOVERY_ENABLED, DEFAULT_FLAGS.discovery),
    map: parseFlag(env?.VITE_PATIENT_MAP_ENABLED, DEFAULT_FLAGS.map),
    hospitalDrawer: parseFlag(env?.VITE_PATIENT_HOSPITAL_DRAWER_ENABLED, DEFAULT_FLAGS.hospitalDrawer),
    doctorMarketplace: parseFlag(env?.VITE_PATIENT_DOCTOR_MARKETPLACE_ENABLED, DEFAULT_FLAGS.doctorMarketplace),
    aiRecommendations: parseFlag(env?.VITE_PATIENT_AI_RECOMMENDATIONS_ENABLED, DEFAULT_FLAGS.aiRecommendations),
  };
}

export function getPatientAppointmentFeatureFlagState() {
  if (typeof import.meta === "undefined" || !import.meta.env) {
    return getPatientAppointmentFeatureFlags({});
  }
  return getPatientAppointmentFeatureFlags(import.meta.env);
}

export function isPatientExperienceMode(user = null, explicitMode = "") {
  const normalizedMode = String(explicitMode || "").trim().toLowerCase();
  if (normalizedMode === "patient") return true;
  if (normalizedMode === "work") return false;

  const role = normalizeRole(user?.role || user?.actualRole || user?.currentRole || "");
  if (PATIENT_MODE_ROLES.has(role)) return true;
  if (NON_PATIENT_CONTEXT_ROLES.has(role)) return false;
  return true;
}

export function getAppointmentExperienceAccessMessage(user = null) {
  if (isPatientExperienceMode(user)) return null;
  return {
    title: "Book Personal Appointment",
    body: "You are currently in Work Mode. Appointments for treatment are booked in your personal health profile.",
    actionLabel: "Switch to My Health",
  };
}
