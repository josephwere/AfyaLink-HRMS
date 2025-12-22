/* ======================================================
   PERMISSION MATRIX (RBAC)
   Single source of truth
====================================================== */

export const PERMISSIONS = {
  SUPER_ADMIN: {
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
};
