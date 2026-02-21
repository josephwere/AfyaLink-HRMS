/* ======================================================
   PERMISSION MATRIX (RBAC)
   Single source of truth
====================================================== */

export const PERMISSIONS = {
  SUPER_ADMIN: {
    "*": ["*"],
   audit: ["read"],
  },
  DEVELOPER: {
    "*": ["*"],
    audit: ["read"],
  },

  HOSPITAL_ADMIN: {
    appointments: ["create", "read", "update", "delete"],
    patients: ["create", "read", "update"],
    users: ["create", "read", "update"],
    billing: ["read", "update"],
    reports: ["read"],
     audit: ["read"],
    inventory: ["read", "update"],
    pharmacy: ["read", "dispense"],
  },

  DOCTOR: {
    appointments: ["read", "update"],
    records: ["create", "read", "update"],
    consultation: ["complete"],
    prescriptions: ["create", "read"],
    lab_orders: ["create", "read"],
  },

  NURSE: {
    appointments: ["read"],
    records: ["read"],
  },

  LAB_TECH: {
    lab_orders: ["read", "update"],
    lab_results: ["create", "read"],
  },

 
PHARMACIST: {
  pharmacy: ["read", "dispense"],
  inventory: ["read", "update"],
},

  PATIENT: {
    appointments: ["create", "read_own"],
    records: ["read_own"],
    payments: ["create", "read_own"],
  },

  HR_MANAGER: {
    users: ["read", "update"],
    reports: ["read"],
    audit: ["read"],
  },

  PAYROLL_OFFICER: {
    billing: ["read", "update"],
    payments: ["read", "update"],
    reports: ["read"],
  },
};
