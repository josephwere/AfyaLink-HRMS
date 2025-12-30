export const MENU = [
  {
    section: "Home",
    items: [{ label: "Home", path: "/" }],
  },

  /* ================= SUPER ADMIN ================= */
  {
    section: "Super Admin",
    roles: ["SUPER_ADMIN"],
    items: [
      { label: "Dashboard", path: "/superadmin" },
      { label: "RBAC", path: "/superadmin/rbac" },
      { label: "Analytics", path: "/analytics" },
      { label: "Reports", path: "/reports" },
    ],
  },

  {
    section: "Security",
    roles: ["SUPER_ADMIN"],
    feature: "auditLogs",
    items: [
      { label: "Create Admin", path: "/admin/create-admin" },
      { label: "Audit Logs", path: "/admin/audit-logs", hidden: true },
    ],
  },

  /* ================= HOSPITAL ADMIN ================= */
  {
    section: "Hospital Admin",
    roles: ["HOSPITAL_ADMIN"],
    items: [
      { label: "Dashboard", path: "/hospitaladmin" },
      { label: "Patients", path: "/hospitaladmin/patients" },
    ],
  },

  {
    section: "Inventory",
    roles: ["HOSPITAL_ADMIN"],
    feature: "inventory",
    items: [{ label: "Inventory", path: "/inventory" }],
  },

  {
    section: "Pharmacy",
    roles: ["HOSPITAL_ADMIN"],
    feature: "pharmacy",
    items: [{ label: "Pharmacy", path: "/pharmacy" }],
  },

  /* ================= DOCTOR ================= */
  {
    section: "Doctor",
    roles: ["DOCTOR"],
    items: [
      { label: "Dashboard", path: "/doctor" },
      { label: "Appointments", path: "/doctor/appointments" },
    ],
  },

  {
    section: "AI",
    feature: "ai",
    roles: ["DOCTOR", "NURSE", "PATIENT"],
    items: [
      { label: "AI Assistant", path: "/ai/medical" },
      { label: "Chatbot", path: "/ai/chatbot" },
    ],
  },

  /* ================= ACCOUNT ================= */
  {
    section: "Account",
    items: [{ label: "Profile", path: "/profile" }],
  },
];
