/**
 * Workflow Domain Permissions
 * Role-based access control for workflow orchestration.
 */

export const workflowPermissions = {
  canList: ["admin", "doctor", "nurse", "lab-tech", "radiologist", "pathologist"],
  canGet: ["admin", "doctor", "nurse", "lab-tech", "radiologist", "pathologist"],
  canCreate: ["admin", "doctor"],
  canStart: ["admin", "doctor"],
  canExecuteStep: ["admin", "doctor", "nurse", "lab-tech", "radiologist", "pathologist"],
  canComplete: ["admin", "doctor"],
  canFail: ["admin", "doctor"],
  canPause: ["admin", "doctor"],
};

export function checkPermission(role, action) {
  const allowed = workflowPermissions[`can${action.charAt(0).toUpperCase()}${action.slice(1)}`];
  if (!allowed) return false;
  return allowed.includes(role);
}

export default {
  ...workflowPermissions,
  checkPermission,
};
