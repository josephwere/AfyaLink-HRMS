import { normalizeRole } from "./normalizeRole";

export const TRAINING_TRACKER_ROLES = Object.freeze([
  "SUPER_ADMIN",
  "SYSTEM_ADMIN",
  "DEVELOPER",
  "HOSPITAL_ADMIN",
  "HOSPITAL_ADMIN_ASSISTANT",
  "HR_MANAGER",
]);

export const TRAINING_PLAYBOOK_ROLES = Object.freeze([
  "SUPER_ADMIN",
  "SYSTEM_ADMIN",
  "DEVELOPER",
  "HOSPITAL_ADMIN",
  "HOSPITAL_ADMIN_ASSISTANT",
  "HR_MANAGER",
]);

export function canAccessTraining(user) {
  const role = normalizeRole(user?.role || user?.actualRole || "");
  return TRAINING_TRACKER_ROLES.includes(role) || TRAINING_PLAYBOOK_ROLES.includes(role);
}
