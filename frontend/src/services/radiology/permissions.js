/**
 * Radiology Domain Permissions
 * Role-based access control for radiology operations.
 */

export const radiologyPermissions = {
  canList: ["admin", "radiologist", "radiologic-technologist", "doctor"],
  canGet: ["admin", "radiologist", "radiologic-technologist", "doctor"],
  canSubmitStudy: ["admin", "radiologic-technologist", "nurse", "doctor"],
  canApproveStudy: ["admin", "radiologist"],
  canRejectStudy: ["admin", "radiologist"],
  canAddImages: ["admin", "radiologic-technologist"],
  canSubmitReport: ["admin", "radiologist"],
  canMarkComplete: ["admin", "radiologist"],
};

export function checkPermission(role, action) {
  const allowed = radiologyPermissions[`can${action.charAt(0).toUpperCase()}${action.slice(1)}`];
  if (!allowed) return false;
  return allowed.includes(role);
}

export default {
  ...radiologyPermissions,
  checkPermission,
};
