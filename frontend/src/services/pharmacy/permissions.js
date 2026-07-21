export const pharmacyPermissions = {
  canList: ["admin", "pharmacist", "doctor", "nurse"],
  canGet: ["admin", "pharmacist", "doctor", "nurse"],
  canCreate: ["admin", "pharmacist"],
  canUpdate: ["admin", "pharmacist"],
  canDelete: ["admin"],
  canAddStock: ["admin", "pharmacist"],
  canDispense: ["admin", "pharmacist", "nurse"],
};

export function checkPermission(role, action) {
  const allowed = pharmacyPermissions[`can${action.charAt(0).toUpperCase()}${action.slice(1)}`];
  if (!allowed) return false;
  return allowed.includes(role);
}

export default {
  ...pharmacyPermissions,
  checkPermission,
};
