/**
 * Laboratory Domain Permissions
 * Role-based access control for laboratory operations.
 */

export const laboratoryPermissions = {
  canList: ["admin", "lab-tech", "pathologist", "doctor"],
  canGet: ["admin", "lab-tech", "pathologist", "doctor"],
  canSubmitSample: ["admin", "lab-tech", "nurse", "doctor"],
  canApproveSample: ["admin", "pathologist"],
  canRejectSample: ["admin", "pathologist"],
  canSubmitResult: ["admin", "lab-tech", "pathologist"],
  canApproveResult: ["admin", "pathologist"],
  canRejectResult: ["admin", "pathologist"],
  canMarkComplete: ["admin", "pathologist"],
};

export function checkPermission(role, action) {
  const allowed = laboratoryPermissions[`can${action.charAt(0).toUpperCase()}${action.slice(1)}`];
  if (!allowed) return false;
  return allowed.includes(role);
}

export default {
  ...laboratoryPermissions,
  checkPermission,
};
