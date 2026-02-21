export const MENU_CONFIG = [
  {
    section: "General",
    items: [
      { label: "Dashboard", path: "/dashboard", icon: "home" },
    ],
  },

  {
    section: "Clinical",
    feature: "patients",
    items: [
      { label: "Patients", path: "/patients", icon: "users" },
    ],
  },

  {
    section: "Pharmacy",
    feature: "pharmacy",
    items: [
      { label: "Pharmacy", path: "/pharmacy", icon: "pill" },
    ],
  },

  {
    section: "Laboratory",
    feature: "lab",
    items: [
      { label: "Lab Dashboard", path: "/lab", icon: "flask" },
    ],
  },

  {
    section: "Billing",
    feature: "payments",
    items: [
      { label: "Billing", path: "/billing", icon: "credit-card" },
    ],
  },

  {
    section: "Administration",
    roles: ["SUPER_ADMIN", "HOSPITAL_ADMIN"],
    items: [
      { label: "Admin Dashboard", path: "/admin", icon: "shield" },
      { label: "Audit Logs", path: "/admin/audit-logs", icon: "file-text" },
    ],
  },

  {
    section: "Super Admin",
    roles: ["SUPER_ADMIN"],
    items: [
      { label: "Create Admin", path: "/admin/create-admin" },
      { label: "Analytics", path: "/analytics" },
    ],
  },
];
