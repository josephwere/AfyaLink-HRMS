export const PERMISSION_REGISTRY = Object.freeze({
  "appointments:create": { resource: "appointments", action: "create" },
  "appointments:view": { resource: "appointments", action: "read" },
  "appointments:update": { resource: "appointments", action: "update" },
  "appointments:cancel": { resource: "appointments", action: "delete" },
  "patients:view": { resource: "patients", action: "read" },
  "patients:update": { resource: "patients", action: "update" },
  "consultations:start": { resource: "consultation", action: "complete" },
  "consultations:end": { resource: "consultation", action: "complete" },
  "billing:view": { resource: "billing", action: "read" },
  "billing:manage": { resource: "billing", action: "update" },
  "profiles:view": { resource: "User", action: "read" },
});

export function normalizePermission(permission, fallbackResource = null) {
  if (!permission) return null;

  if (typeof permission === "string") {
    const trimmed = permission.trim();
    if (!trimmed) return null;

    if (trimmed.includes(":")) {
      const [resource, action] = trimmed.split(":");
      return { resource: resource.trim(), action: action.trim() };
    }

    const registryEntry = PERMISSION_REGISTRY[trimmed];
    if (registryEntry) {
      return { resource: registryEntry.resource, action: registryEntry.action };
    }

    return { resource: fallbackResource || "unknown", action: trimmed };
  }

  if (typeof permission === "object") {
    const resource = permission.resource || permission.name || fallbackResource || "unknown";
    const action = permission.action || permission.permission || permission.operation || "read";
    return { resource, action };
  }

  return null;
}
