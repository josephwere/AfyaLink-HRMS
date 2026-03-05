const ROLE_REQUIREMENTS = {
  DEFAULT: [
    { key: "nationalIdNumber", label: "National ID number", required: true },
    { key: "nationalIdCountry", label: "National ID country", required: true },
    { key: "phoneVerified", label: "Phone verified", required: true },
    { key: "employment.employeeId", label: "Employee ID", required: true },
    { key: "credentials.documents", label: "At least one credential document", required: true },
  ],
  LICENSED_CLINICAL: [
    { key: "licenseNumber", label: "Professional license number", required: true },
    { key: "licenseExpiry", label: "License expiry date", required: true },
  ],
  COMMUNITY: [
    { key: "credentials.certifications", label: "Community certification(s)", required: true },
  ],
  SECURITY: [
    { key: "credentials.documents", label: "Security clearance document", required: true },
  ],
};

const LICENSED_CLINICAL_ROLES = new Set([
  "DOCTOR",
  "SURGEON",
  "NURSE",
  "LAB_TECH",
  "PHARMACIST",
  "RADIOLOGIST",
  "THERAPIST",
]);

const COMMUNITY_ROLES = new Set(["COMMUNITY_HEALTH_WORKER"]);
const SECURITY_ROLES = new Set(["SECURITY_OFFICER", "SECURITY_ADMIN"]);

function getByPath(obj, key) {
  return String(key || "")
    .split(".")
    .reduce((acc, part) => (acc && typeof acc === "object" ? acc[part] : undefined), obj);
}

function isPresent(key, value) {
  if (key === "phoneVerified") return value === true;
  if (key === "licenseExpiry") {
    if (!value) return false;
    const expiry = new Date(value);
    return !Number.isNaN(expiry.getTime()) && expiry.getTime() > Date.now();
  }
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return value !== null && value !== undefined && value !== false;
}

function requirementsForRole(role) {
  const out = [...ROLE_REQUIREMENTS.DEFAULT];
  if (LICENSED_CLINICAL_ROLES.has(role)) out.push(...ROLE_REQUIREMENTS.LICENSED_CLINICAL);
  if (COMMUNITY_ROLES.has(role)) out.push(...ROLE_REQUIREMENTS.COMMUNITY);
  if (SECURITY_ROLES.has(role)) out.push(...ROLE_REQUIREMENTS.SECURITY);
  return out;
}

export function evaluateStaffIdentityChecklist(userLike = {}) {
  const role = String(userLike.role || "").toUpperCase();
  const requirements = requirementsForRole(role);
  const items = requirements.map((req) => {
    const value = getByPath(userLike, req.key);
    const present = isPresent(req.key, value);
    return {
      key: req.key,
      label: req.label,
      required: Boolean(req.required),
      present,
    };
  });
  const missing = items.filter((item) => item.required && !item.present);
  const completed = items.length - missing.length;
  const completionRate = items.length ? Math.round((completed / items.length) * 100) : 100;
  return {
    role,
    items,
    missingKeys: missing.map((m) => m.key),
    missingLabels: missing.map((m) => m.label),
    completionRate,
    compliant: missing.length === 0,
  };
}

