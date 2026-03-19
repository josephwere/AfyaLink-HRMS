import { ROLES } from "../constants/roles";

/**
 * Declarative role → landing route
 * Order does NOT matter
 */
export const ROLE_REDIRECT_MAP = Object.freeze({
  [ROLES.SUPER_ADMIN]: "/super-admin",
  [ROLES.SUPER_ASSISTANT]: "/system-admin/unified-assistant",
  [ROLES.HOSPITAL_ADMIN]: "/admin",
  [ROLES.DOCTOR]: "/doctor",
  [ROLES.NURSE]: "/nurse",
  [ROLES.LAB_TECH]: "/lab",
  [ROLES.PHARMACIST]: "/pharmacy",
  [ROLES.GOVERNMENT_REGULATOR]: "/system-admin/government-claims",
  [ROLES.GOVERNMENT_ADMIN]: "/system-admin/government-claims",
  [ROLES.GOVERNMENT_AUDITOR]: "/system-admin/government-claims",
  [ROLES.GOVERNMENT_INSPECTOR]: "/system-admin/government-claims",
  [ROLES.GOVERNMENT_ANALYST]: "/system-admin/government-claims",
  [ROLES.PATIENT]: "/dashboard",
  [ROLES.GUEST]: "/",
});
