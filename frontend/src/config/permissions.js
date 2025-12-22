export const PERMISSIONS = {
  appointments: {
    read: ["SUPER_ADMIN", "HOSPITAL_ADMIN", "DOCTOR", "NURSE"],
    create: ["DOCTOR", "HOSPITAL_ADMIN"],
    update: ["DOCTOR", "HOSPITAL_ADMIN"],
    delete: ["HOSPITAL_ADMIN"],
  },

  pharmacy: {
    read: ["PHARMACIST", "HOSPITAL_ADMIN"],
    dispense: ["PHARMACIST"],
    manage: ["HOSPITAL_ADMIN"],
  },

  billing: {
    read: ["HOSPITAL_ADMIN", "ACCOUNTANT"],
    create: ["ACCOUNTANT"],
  },

  reports: {
    read: ["SUPER_ADMIN", "HOSPITAL_ADMIN"],
  },

  audit: {
    read: ["SUPER_ADMIN", "HOSPITAL_ADMIN"],
  },
};
