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
  SUPER_ASSISTANT: {
    "*": ["*"],
    audit: ["read"],
  },

  GOVERNMENT_ADMIN: {
    "*": ["*"],
    audit: ["read"],
  },
  GOVERNMENT_REGULATOR: {
    claims: ["read", "review", "verify"],
    hospitals: ["read", "update"],
    inspections: ["read", "write", "schedule"],
    enforcement: ["read", "write"],
    analytics: ["read"],
    audit: ["read"],
  },
  GOVERNMENT_AUDITOR: {
    claims: ["read", "review", "verify"],
    hospitals: ["read"],
    inspections: ["read"],
    analytics: ["read"],
    audit: ["read"],
  },
  GOVERNMENT_INSPECTOR: {
    hospitals: ["read"],
    inspections: ["read", "write", "schedule"],
    enforcement: ["read"],
    audit: ["read"],
  },
  GOVERNMENT_ANALYST: {
    claims: ["read"],
    hospitals: ["read"],
    analytics: ["read"],
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
  HOSPITAL_ADMIN_ASSISTANT: {
    admin: ["read"],
    appointments: ["create", "read", "update"],
    patients: ["create", "read", "update"],
    users: ["create", "read", "update"],
    reports: ["read"],
    inventory: ["read"],
    pharmacy: ["read"],
    security: ["view"],
  },

  DOCTOR: {
    appointments: ["create", "read", "update", "delete"],
    patients: ["read"],
    records: ["create", "read", "update"],
    consultation: ["complete"],
    prescriptions: ["create", "read"],
    lab_orders: ["create", "read"],
    inventory: ["read"],
    pharmacy: ["read"],
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
    inventory: ["read"],
    pharmacy: ["read"],
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
