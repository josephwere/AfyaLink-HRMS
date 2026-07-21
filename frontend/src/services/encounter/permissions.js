export const encounterPermissions = {
  canList: ["admin", "doctor", "nurse", "clinical-admin"],
  canGet: ["admin", "doctor", "nurse", "clinical-admin"],
  canCreate: ["admin", "doctor"],
  canUpdate: ["admin", "doctor"],
  canClose: ["admin", "doctor"],
  canApplyCloseoutEffects: ["admin", "doctor", "billing"],
  canCreateBillingHandoff: ["admin", "doctor", "billing"],
  canResolveNurseEscalation: ["admin", "doctor", "nurse"],
};

export function checkPermission(role, action) {
  const allowed = encounterPermissions[`can${action.charAt(0).toUpperCase()}${action.slice(1)}`];
  if (!allowed) return false;
  return allowed.includes(role);
}

export default {
  ...encounterPermissions,
  checkPermission,
};
