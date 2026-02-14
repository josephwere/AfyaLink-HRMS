import { ROLES } from "../constants/roles";

/**
 * Declarative role → landing route
 * Order does NOT matter
 */
export const ROLE_REDIRECT_MAP = Object.freeze({
  [ROLES.SUPER_ADMIN]: "/super-admin",
  [ROLES.HOSPITAL_ADMIN]: "/admin",
  [ROLES.DOCTOR]: "/doctor",
  [ROLES.NURSE]: "/nurse",
  [ROLES.LAB_TECH]: "/lab",
  [ROLES.PHARMACIST]: "/pharmacy",
  [ROLES.PATIENT]: "/dashboard",
  [ROLES.GUEST]: "/",
});
