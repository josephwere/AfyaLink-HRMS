export const PERMISSIONS = {
  appointments: {
    read: ["SUPER_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "DOCTOR", "NURSE"],
    create: ["DOCTOR", "HOSPITAL_ADMIN"],
    update: ["DOCTOR", "HOSPITAL_ADMIN"],
    delete: ["HOSPITAL_ADMIN"],
  },

  pharmacy: {
    read: ["PHARMACIST", "HOSPITAL_ADMIN"],
    dispense: ["PHARMACIST"],
    manage: ["HOSPITAL_ADMIN"],
  },

  inventory: {
    read: ["PHARMACIST", "HOSPITAL_ADMIN", "SUPER_ADMIN", "DEVELOPER", "SYSTEM_ADMIN"],
    update: ["PHARMACIST", "HOSPITAL_ADMIN"],
  },

  billing: {
    read: ["HOSPITAL_ADMIN", "ACCOUNTANT"],
    create: ["ACCOUNTANT"],
  },

  reports: {
    read: ["SUPER_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN"],
  },

  audit: {
    read: ["SUPER_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN"],
  },
};
