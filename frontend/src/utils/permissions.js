const ROLE_FALLBACKS = {
  canManageBeds: ["HOSPITAL_ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"],
  canManageRooms: ["HOSPITAL_ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"],
  canManageWards: ["HOSPITAL_ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"],
  canManageStaff: ["HOSPITAL_ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"],
  canCreateAppointments: ["HOSPITAL_ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "RECEPTIONIST", "DOCTOR"],
};

const CAPABILITY_FALLBACKS = {
  canManageBeds: ["facility.beds.manage"],
  canManageRooms: ["facility.rooms.manage"],
  canManageWards: ["facility.wards.manage"],
  canManageStaff: ["users.manage"],
  canCreateAppointments: ["clinical.appointments.manage"],
};

function normalizeRole(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeCapabilities(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  if (value && typeof value === "object") {
    return Object.keys(value)
      .filter((key) => Boolean(value[key]))
      .map((key) => String(key).trim())
      .filter(Boolean);
  }
  return [];
}

function evaluate(action, actor = {}) {
  const role = normalizeRole(actor?.role);
  const rawCapabilities = Array.isArray(actor) ? actor : actor?.capabilities || actor?.permissions || [];
  const capabilities = normalizeCapabilities(rawCapabilities);
  const allowedRoles = ROLE_FALLBACKS[action] || [];
  const requiredCapabilities = CAPABILITY_FALLBACKS[action] || [];

  if (allowedRoles.includes(role)) return true;
  return requiredCapabilities.some((capability) => capabilities.includes(capability));
}

export function canManageBeds(actor = {}) {
  return evaluate("canManageBeds", actor);
}

export function canManageRooms(actor = {}) {
  return evaluate("canManageRooms", actor);
}

export function canManageWards(actor = {}) {
  return evaluate("canManageWards", actor);
}

export function canManageStaff(actor = {}) {
  return evaluate("canManageStaff", actor);
}

export function canCreateAppointments(actor = {}) {
  return evaluate("canCreateAppointments", actor);
}
