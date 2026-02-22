/* ======================================================
   PERMISSION MATRIX (RBAC)
   Single source of truth
====================================================== */

export const PERMISSIONS = {
  SUPER_ADMIN: {
    "*": ["*"],
   audit: ["read"],
  },
  SYSTEM_ADMIN: {
    "*": ["*"],
    audit: ["read"],
  },
  DEVELOPER: {
    "*": ["*"],
    audit: ["read"],
  },

  HOSPITAL_ADMIN: {
    admin: ["read", "write"],
    appointments: ["create", "read", "update", "delete"],
    patients: ["create", "read", "update"],
    users: ["create", "read", "update"],
    billing: ["read", "update"],
    reports: ["read"],
     audit: ["read"],
    inventory: ["read", "update"],
    pharmacy: ["read", "write", "dispense"],
    security: ["view"],
    ACCESS_ENTRY: ["VERIFY", "CHECK_IN", "CHECK_OUT"],
    emergency: ["revoke"],
  },

  DOCTOR: {
    appointments: ["create", "read", "update", "delete"],
    patients: ["read"],
    records: ["create", "read", "update"],
    consultation: ["complete"],
    prescriptions: ["create", "read"],
    lab_orders: ["create", "read"],
    doctor: ["write"],
  },

  NURSE: {
    appointments: ["read"],
    patients: ["read"],
    records: ["read"],
  },

  LAB_TECH: {
    patients: ["read"],
    lab_orders: ["read", "update"],
    lab_results: ["create", "read"],
  },

 
PHARMACIST: {
  pharmacy: ["read", "write", "dispense"],
  inventory: ["read", "update"],
},

  SECURITY_ADMIN: {
    security: ["view"],
    ACCESS_ENTRY: ["VERIFY", "CHECK_IN", "CHECK_OUT"],
  },
  SECURITY_OFFICER: {
    security: ["view"],
    ACCESS_ENTRY: ["VERIFY", "CHECK_IN", "CHECK_OUT"],
  },

  PATIENT: {
    appointments: ["create", "read", "read_own"],
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
