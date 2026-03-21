import { ROLES } from "../constants/roles";

/**
 * Declarative role → landing route
 * Order does NOT matter
 */
export const ROLE_REDIRECT_MAP = Object.freeze({
  [ROLES.SUPER_ADMIN]: "/super-admin",
  [ROLES.SUPER_ASSISTANT]: "/system-admin/unified-assistant",
  [ROLES.SYSTEM_ADMIN]: "/system-admin",
  [ROLES.DEVELOPER]: "/developer",
  [ROLES.HOSPITAL_ADMIN]: "/hospital-admin",
  [ROLES.HOSPITAL_ADMIN_ASSISTANT]: "/hospital-admin",
  [ROLES.DOCTOR]: "/doctor",
  [ROLES.SURGEON]: "/surgeon",
  [ROLES.NURSE]: "/nurse",
  [ROLES.LAB_TECH]: "/lab-tech",
  [ROLES.PHARMACIST]: "/pharmacy",
  [ROLES.RADIOLOGIST]: "/radiologist",
  [ROLES.THERAPIST]: "/therapist",
  [ROLES.RECEPTIONIST]: "/receptionist",
  [ROLES.GOVERNMENT_REGULATOR]: "/system-admin/government-claims",
  [ROLES.GOVERNMENT_ADMIN]: "/system-admin/government-claims",
  [ROLES.GOVERNMENT_AUDITOR]: "/system-admin/government-claims",
  [ROLES.GOVERNMENT_INSPECTOR]: "/system-admin/government-claims",
  [ROLES.GOVERNMENT_ANALYST]: "/system-admin/government-claims",
  [ROLES.PATIENT]: "/patient",
  [ROLES.GUEST]: "/guest",
});
