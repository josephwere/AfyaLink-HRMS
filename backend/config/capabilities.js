import { normalizeRole } from "../utils/normalizeRole.js";

/* ======================================================
   CAPABILITY REGISTRY
   Single source of truth for:
   - Backend authorization
   - Frontend navigation
   - Dashboard widgets
   - Command palette results
   - Quick actions
   - Search
   
   Metadata Fields:
   - id: Unique capability ID (domain.resource.action)
   - category: Grouping for display
   - title: Display name
   - description: Longer description
   - icon: Icon name for UI
   - module: Feature module this belongs to
   - route: Route to this feature
   - quickAction: Label for quick action (if enabled)
   - dashboardWidget: Component name for dashboard
   - searchKeywords: Array of keywords for search
   - order: Display order in navigation
   - permissions: Backend permission checks
   - hidden: Hide from UI navigation (still authorized)
====================================================== */

export const CAPABILITY_REGISTRY = {
  // ========== FACILITY MANAGEMENT ==========
  "facility.beds.view": {
    category: "Facility Management",
    title: "View Beds",
    description: "View hospital bed inventory and status",
    icon: "🛏️",
    module: "Facility",
    searchKeywords: ["beds", "inventory", "status", "availability"],
    order: 10,
    permissions: ["facility:read"],
  },
  "facility.beds.manage": {
    category: "Facility Management",
    title: "Manage Beds",
    description: "Create, update, and manage hospital beds",
    icon: "🛏️",
    module: "Facility",
    route: "/facility/beds",
    quickAction: "Add Bed",
    dashboardWidget: "BedOccupancyWidget",
    searchKeywords: ["beds", "create", "edit", "add", "rooms", "occupancy"],
    order: 11,
    permissions: ["facility:create", "facility:update", "facility:delete"],
  },
  "facility.wards.view": {
    category: "Facility Management",
    title: "View Wards",
    description: "View hospital wards and structure",
    icon: "🏥",
    module: "Facility",
    searchKeywords: ["wards", "departments", "floors", "structure"],
    order: 20,
    permissions: ["facility:read"],
  },
  "facility.wards.manage": {
    category: "Facility Management",
    title: "Manage Wards",
    description: "Create and manage hospital wards",
    icon: "🏥",
    module: "Facility",
    route: "/facility/wards",
    quickAction: "Add Ward",
    dashboardWidget: "WardOccupancyWidget",
    searchKeywords: ["wards", "add", "create", "department", "edit"],
    order: 21,
    permissions: ["facility:create", "facility:update", "facility:delete"],
  },
  "facility.rooms.view": {
    category: "Facility Management",
    title: "View Rooms",
    description: "View hospital rooms",
    icon: "🚪",
    module: "Facility",
    searchKeywords: ["rooms", "spaces", "capacity"],
    order: 30,
    permissions: ["facility:read"],
  },
  "facility.rooms.manage": {
    category: "Facility Management",
    title: "Manage Rooms",
    description: "Create and manage hospital rooms",
    icon: "🚪",
    module: "Facility",
    route: "/facility/rooms",
    quickAction: "Add Room",
    searchKeywords: ["rooms", "create", "edit", "capacity"],
    order: 31,
    permissions: ["facility:create", "facility:update", "facility:delete"],
  },
  "facility.buildings.view": {
    category: "Facility Management",
    title: "View Buildings",
    description: "View hospital buildings and structures",
    icon: "🏢",
    module: "Facility",
    searchKeywords: ["buildings", "structures", "locations"],
    order: 40,
    permissions: ["facility:read"],
  },
  "facility.buildings.manage": {
    category: "Facility Management",
    title: "Manage Buildings",
    description: "Create and manage hospital buildings",
    icon: "🏢",
    module: "Facility",
    route: "/facility/buildings",
    dashboardWidget: "FacilityStructureWidget",
    searchKeywords: ["buildings", "add", "create", "structure"],
    order: 41,
    permissions: ["facility:create", "facility:update", "facility:delete"],
  },
  "facility.maintenance.view": {
    category: "Facility Management",
    title: "View Maintenance",
    description: "View facility maintenance status",
    icon: "🔧",
    module: "Facility",
    dashboardWidget: "MaintenanceStatusWidget",
    searchKeywords: ["maintenance", "repairs", "issues", "status"],
    order: 50,
    permissions: ["facility:read"],
  },

  // ========== USERS & STAFF ==========
  "users.view": {
    category: "User Management",
    title: "View Staff",
    description: "View staff and user directory",
    icon: "👥",
    module: "Administration",
    dashboardWidget: "StaffDirectoryWidget",
    searchKeywords: ["staff", "users", "employees", "directory", "contact"],
    order: 100,
    permissions: ["users:read"],
  },
  "users.manage": {
    category: "User Management",
    title: "Manage Staff",
    description: "Create, update, and manage staff accounts",
    icon: "👥",
    module: "Administration",
    route: "/hospital-admin/staff",
    quickAction: "Add Staff Member",
    dashboardWidget: "StaffManagementWidget",
    searchKeywords: ["staff", "add", "users", "create", "hire"],
    order: 101,
    permissions: ["users:create", "users:update", "users:delete"],
  },
  "users.roles.assign": {
    category: "User Management",
    title: "Assign Roles",
    description: "Assign and manage user roles",
    icon: "🔑",
    module: "Administration",
    searchKeywords: ["roles", "permissions", "access", "assign"],
    order: 102,
    permissions: ["users:update:roles"],
  },
  "users.shifts.manage": {
    category: "User Management",
    title: "Manage Shifts",
    description: "Create and assign staff shifts",
    icon: "🕐",
    module: "Administration",
    route: "/hospital-admin/shifts",
    dashboardWidget: "ShiftManagementWidget",
    searchKeywords: ["shifts", "schedule", "roster", "assign"],
    order: 103,
    permissions: ["shifts:create", "shifts:update", "shifts:delete"],
  },

  // ========== CLINICAL OPERATIONS ==========
  "clinical.patients.view": {
    category: "Clinical Operations",
    title: "View Patients",
    description: "View patient list and details",
    icon: "🩺",
    module: "Clinical",
    dashboardWidget: "PatientListWidget",
    searchKeywords: ["patients", "list", "view", "records"],
    order: 200,
    permissions: ["patients:read"],
  },
  "clinical.appointments.manage": {
    category: "Clinical Operations",
    title: "Manage Appointments",
    description: "Schedule and manage appointments",
    icon: "📅",
    module: "Clinical",
    route: "/hospital-admin/appointments",
    quickAction: "New Appointment",
    dashboardWidget: "AppointmentScheduleWidget",
    searchKeywords: ["appointments", "schedule", "new", "booking", "calendar"],
    order: 201,
    permissions: ["appointments:create", "appointments:update", "appointments:delete"],
  },
  "clinical.consultations.monitor": {
    category: "Clinical Operations",
    title: "Monitor Consultations",
    description: "View consultation queue and status",
    icon: "☎️",
    module: "Clinical",
    route: "/hospital-admin/consultation-monitor",
    dashboardWidget: "ConsultationQueueWidget",
    searchKeywords: ["consultations", "queue", "monitor", "status"],
    order: 202,
    permissions: ["consultations:read"],
  },
  "clinical.transfers.manage": {
    category: "Clinical Operations",
    title: "Manage Transfers",
    description: "Manage patient transfers between facilities",
    icon: "🔄",
    module: "Clinical",
    route: "/hospital-admin/transfer-command-center",
    dashboardWidget: "TransferCommandWidget",
    searchKeywords: ["transfers", "move", "relocate", "facility"],
    order: 203,
    permissions: ["transfers:create", "transfers:update"],
  },

  // ========== PHARMACY ==========
  "pharmacy.inventory.view": {
    category: "Pharmacy",
    title: "View Pharmacy Inventory",
    description: "View pharmacy stock levels",
    icon: "💊",
    module: "Pharmacy",
    dashboardWidget: "PharmacyInventoryWidget",
    searchKeywords: ["pharmacy", "inventory", "stock", "drugs"],
    order: 300,
    permissions: ["pharmacy:read"],
  },
  "pharmacy.inventory.manage": {
    category: "Pharmacy",
    title: "Manage Pharmacy Inventory",
    description: "Update pharmacy stock and orders",
    icon: "💊",
    module: "Pharmacy",
    route: "/hospital-admin/pharmacy-inventory",
    quickAction: "Order Drugs",
    dashboardWidget: "PharmacyManagementWidget",
    searchKeywords: ["pharmacy", "stock", "order", "update", "receive"],
    order: 301,
    permissions: ["pharmacy:create", "pharmacy:update", "pharmacy:delete"],
  },
  "pharmacy.dispensing": {
    category: "Pharmacy",
    title: "Dispense Medications",
    description: "Dispense medications to patients",
    icon: "🏥",
    module: "Pharmacy",
    quickAction: "Dispense",
    searchKeywords: ["dispensing", "medications", "prescriptions", "issue"],
    order: 302,
    permissions: ["pharmacy:dispense"],
  },
  "pharmacy.oversight": {
    category: "Pharmacy",
    title: "Pharmacy Oversight",
    description: "Monitor pharmacy operations and KPIs",
    icon: "📊",
    module: "Pharmacy",
    route: "/hospital-admin/pharmacy-referrals",
    dashboardWidget: "PharmacyOversightWidget",
    searchKeywords: ["pharmacy", "monitor", "kpi", "performance"],
    order: 303,
    permissions: ["pharmacy:read"],
  },

  // ========== LABORATORY ==========
  "laboratory.results.view": {
    category: "Laboratory",
    title: "View Lab Results",
    description: "View laboratory test results",
    icon: "🔬",
    module: "Laboratory",
    dashboardWidget: "LabResultsWidget",
    searchKeywords: ["lab", "results", "tests", "samples"],
    order: 400,
    permissions: ["laboratory:read"],
  },
  "laboratory.orders.manage": {
    category: "Laboratory",
    title: "Manage Lab Orders",
    description: "Create and manage lab test orders",
    icon: "🔬",
    module: "Laboratory",
    quickAction: "New Lab Order",
    dashboardWidget: "LabOrderWidget",
    searchKeywords: ["lab", "order", "test", "request"],
    order: 401,
    permissions: ["laboratory:create", "laboratory:update"],
  },
  "laboratory.oversight": {
    category: "Laboratory",
    title: "Lab Oversight",
    description: "Monitor lab queue and equipment status",
    icon: "📊",
    module: "Laboratory",
    route: "/hospital-admin/laboratory-oversight",
    dashboardWidget: "LabOversightWidget",
    searchKeywords: ["lab", "queue", "monitor", "equipment", "kpi"],
    order: 402,
    permissions: ["laboratory:read"],
  },

  // ========== RADIOLOGY ==========
  "radiology.studies.view": {
    category: "Radiology",
    title: "View Imaging Studies",
    description: "View radiology imaging queue",
    icon: "🖼️",
    module: "Radiology",
    dashboardWidget: "RadiologyQueueWidget",
    searchKeywords: ["imaging", "radiology", "xray", "scan", "mri"],
    order: 500,
    permissions: ["radiology:read"],
  },
  "radiology.orders.manage": {
    category: "Radiology",
    title: "Manage Imaging Orders",
    description: "Create and manage imaging orders",
    icon: "🖼️",
    module: "Radiology",
    quickAction: "New Imaging Order",
    dashboardWidget: "RadiologyOrderWidget",
    searchKeywords: ["imaging", "order", "radiology", "xray", "request"],
    order: 501,
    permissions: ["radiology:create", "radiology:update"],
  },
  "radiology.oversight": {
    category: "Radiology",
    title: "Radiology Oversight",
    description: "Monitor imaging queue and utilization",
    icon: "📊",
    module: "Radiology",
    route: "/hospital-admin/radiology-oversight",
    dashboardWidget: "RadiologyOversightWidget",
    searchKeywords: ["radiology", "monitor", "queue", "kpi"],
    order: 502,
    permissions: ["radiology:read"],
  },

  // ========== FINANCIAL OPERATIONS ==========
  "finance.billing.view": {
    category: "Financial Operations",
    title: "View Billing",
    description: "View billing and invoices",
    icon: "💰",
    module: "Finance",
    dashboardWidget: "BillingViewWidget",
    searchKeywords: ["billing", "invoices", "payments", "charges"],
    order: 600,
    permissions: ["finance:read"],
  },
  "finance.billing.manage": {
    category: "Financial Operations",
    title: "Manage Billing",
    description: "Create and manage invoices",
    icon: "💰",
    module: "Finance",
    route: "/hospital-admin/billing",
    quickAction: "Create Invoice",
    dashboardWidget: "BillingManagementWidget",
    searchKeywords: ["billing", "invoice", "create", "charge", "payment"],
    order: 601,
    permissions: ["finance:create", "finance:update"],
  },
  "finance.claims.view": {
    category: "Financial Operations",
    title: "View Claims",
    description: "View insurance and NHIF claims",
    icon: "📋",
    module: "Finance",
    dashboardWidget: "ClaimsViewWidget",
    searchKeywords: ["claims", "insurance", "nhif", "reimbursement"],
    order: 602,
    permissions: ["finance:read"],
  },
  "finance.claims.manage": {
    category: "Financial Operations",
    title: "Manage Claims",
    description: "Submit and manage insurance claims",
    icon: "📋",
    module: "Finance",
    route: "/hospital-admin/claims",
    quickAction: "Submit Claim",
    dashboardWidget: "ClaimsManagementWidget",
    searchKeywords: ["claims", "submit", "insurance", "file"],
    order: 603,
    permissions: ["finance:create", "finance:update"],
  },
  "finance.revenue.view": {
    category: "Financial Operations",
    title: "View Revenue",
    description: "View revenue and financial reports",
    icon: "📈",
    module: "Finance",
    route: "/hospital-admin/financials",
    dashboardWidget: "RevenueAnalyticsWidget",
    searchKeywords: ["revenue", "finance", "income", "reports", "analytics"],
    order: 604,
    permissions: ["finance:read"],
  },

  // ========== EMERGENCY & SECURITY ==========
  "emergency.override.activate": {
    category: "Emergency & Security",
    title: "Activate Emergency Override",
    description: "Activate emergency break-glass access",
    icon: "🚨",
    module: "Security",
    quickAction: "Emergency Access",
    searchKeywords: ["emergency", "override", "breakglass", "access"],
    order: 700,
    permissions: ["emergency:activate"],
  },
  "emergency.override.review": {
    category: "Emergency & Security",
    title: "Review Emergency Overrides",
    description: "Review and audit emergency overrides",
    icon: "🚨",
    module: "Security",
    route: "/hospital-admin/emergency-center",
    dashboardWidget: "EmergencyOversightWidget",
    searchKeywords: ["emergency", "review", "audit", "override"],
    order: 701,
    permissions: ["emergency:read"],
  },
  "security.access.view": {
    category: "Emergency & Security",
    title: "View Access Logs",
    description: "View facility access and check-ins",
    icon: "🔐",
    module: "Security",
    dashboardWidget: "AccessLogsWidget",
    searchKeywords: ["security", "access", "logs", "check-in"],
    order: 702,
    permissions: ["security:read"],
  },

  // ========== AUDIT & COMPLIANCE ==========
  "audit.logs.view": {
    category: "Audit & Compliance",
    title: "View Audit Logs",
    description: "View system audit and compliance logs",
    icon: "📋",
    module: "Compliance",
    route: "/hospital-admin/audit",
    dashboardWidget: "AuditLogsWidget",
    searchKeywords: ["audit", "logs", "compliance", "history"],
    order: 800,
    permissions: ["audit:read"],
  },
  "audit.export": {
    category: "Audit & Compliance",
    title: "Export Audit Data",
    description: "Export audit and compliance reports",
    icon: "📥",
    module: "Compliance",
    quickAction: "Export Audit Report",
    searchKeywords: ["export", "audit", "report", "download"],
    order: 801,
    permissions: ["audit:export"],
  },

  // ========== ANALYTICS & REPORTING ==========
  "analytics.view": {
    category: "Analytics & Reporting",
    title: "View Analytics",
    description: "View operational and clinical analytics",
    icon: "📊",
    module: "Analytics",
    route: "/hospital-admin/analytics",
    dashboardWidget: "AnalyticsDashboardWidget",
    searchKeywords: ["analytics", "reporting", "data", "insights"],
    order: 900,
    permissions: ["analytics:read"],
  },
  "reports.generate": {
    category: "Analytics & Reporting",
    title: "Generate Reports",
    description: "Generate custom reports",
    icon: "📄",
    module: "Analytics",
    quickAction: "Generate Report",
    searchKeywords: ["reports", "generate", "export", "custom"],
    order: 901,
    permissions: ["reports:create"],
  },

  // ========== SYSTEM ADMINISTRATION ==========
  "system.settings.view": {
    category: "System Administration",
    title: "View Settings",
    description: "View system settings",
    icon: "⚙️",
    module: "Administration",
    searchKeywords: ["settings", "configuration", "system"],
    order: 1000,
    permissions: ["system:read"],
  },
  "system.settings.manage": {
    category: "System Administration",
    title: "Manage Settings",
    description: "Configure system settings and integrations",
    icon: "⚙️",
    module: "Administration",
    route: "/hospital-admin/settings",
    dashboardWidget: "SystemSettingsWidget",
    searchKeywords: ["settings", "configure", "system", "integrate"],
    order: 1001,
    permissions: ["system:update"],
  },
  "system.features.toggle": {
    category: "System Administration",
    title: "Feature Flags",
    description: "Enable and disable features",
    icon: "🎛️",
    module: "Administration",
    searchKeywords: ["features", "flags", "toggle", "enable"],
    order: 1002,
    permissions: ["system:update"],
  },
  "system.integrations.manage": {
    category: "System Administration",
    title: "Manage Integrations",
    description: "Configure third-party integrations",
    icon: "🔌",
    module: "Administration",
    searchKeywords: ["integrations", "connect", "api", "third-party"],
    order: 1003,
    permissions: ["system:update"],
  },
};

/**
 * Map role to list of capabilities
 * Returns all capabilities available to a role
 */
export function getCapabilitiesForRole(role) {
  const roleCapabilityMap = {
    HOSPITAL_ADMIN: [
      // Facility Management
      "facility.beds.view",
      "facility.beds.manage",
      "facility.wards.view",
      "facility.wards.manage",
      "facility.rooms.view",
      "facility.rooms.manage",
      "facility.buildings.view",
      "facility.buildings.manage",
      "facility.maintenance.view",

      // Users & Staff
      "users.view",
      "users.manage",
      "users.roles.assign",
      "users.shifts.manage",

      // Clinical Operations
      "clinical.patients.view",
      "clinical.appointments.manage",
      "clinical.consultations.monitor",
      "clinical.transfers.manage",

      // Pharmacy
      "pharmacy.inventory.view",
      "pharmacy.inventory.manage",
      "pharmacy.oversight",

      // Laboratory
      "laboratory.results.view",
      "laboratory.orders.manage",
      "laboratory.oversight",

      // Radiology
      "radiology.studies.view",
      "radiology.orders.manage",
      "radiology.oversight",

      // Financial Operations
      "finance.billing.view",
      "finance.billing.manage",
      "finance.claims.view",
      "finance.claims.manage",
      "finance.revenue.view",

      // Emergency & Security
      "emergency.override.activate",
      "emergency.override.review",
      "security.access.view",

      // Audit & Compliance
      "audit.logs.view",
      "audit.export",

      // Analytics
      "analytics.view",
      "reports.generate",

      // System Administration
      "system.settings.view",
      "system.settings.manage",
      "system.features.toggle",
      "system.integrations.manage",
    ],

    HOSPITAL_ADMIN_ASSISTANT: [
      // Facility Management (view only)
      "facility.beds.view",
      "facility.beds.manage",
      "facility.wards.view",
      "facility.wards.manage",
      "facility.rooms.view",
      "facility.rooms.manage",
      "facility.buildings.view",

      // Users & Staff
      "users.view",
      "users.manage",
      "users.shifts.manage",

      // Clinical Operations
      "clinical.patients.view",
      "clinical.appointments.manage",
      "clinical.consultations.monitor",
      "clinical.transfers.manage",

      // Pharmacy
      "pharmacy.inventory.view",
      "pharmacy.inventory.manage",
      "pharmacy.oversight",

      // Laboratory
      "laboratory.results.view",
      "laboratory.orders.manage",

      // Radiology
      "radiology.studies.view",
      "radiology.orders.manage",

      // Financial Operations
      "finance.billing.view",
      "finance.billing.manage",
      "finance.claims.view",
      "finance.revenue.view",

      // Audit & Compliance
      "audit.logs.view",

      // Analytics
      "analytics.view",
    ],

    DOCTOR: [
      "clinical.patients.view",
      "clinical.appointments.manage",
      "clinical.consultations.monitor",
      "laboratory.orders.manage",
      "laboratory.results.view",
      "radiology.orders.manage",
      "pharmacy.inventory.view",
    ],

    NURSE: [
      "clinical.patients.view",
      "clinical.appointments.manage",
      "facility.beds.view",
    ],

    LAB_TECH: [
      "laboratory.results.view",
      "laboratory.orders.manage",
      "clinical.patients.view",
    ],

    PHARMACIST: [
      "pharmacy.inventory.view",
      "pharmacy.inventory.manage",
      "pharmacy.dispensing",
      "clinical.patients.view",
    ],

    RADIOLOGIST: [
      "radiology.studies.view",
      "radiology.orders.manage",
      "clinical.patients.view",
    ],

    RECEPTIONIST: [
      "clinical.appointments.manage",
      "clinical.patients.view",
    ],

    SECURITY_ADMIN: [
      "security.access.view",
      "audit.logs.view",
    ],

    SECURITY_OFFICER: [
      "security.access.view",
    ],

    HR_MANAGER: [
      "users.view",
      "users.shifts.manage",
      "analytics.view",
    ],

    PAYROLL_OFFICER: [
      "finance.billing.view",
      "analytics.view",
    ],

    SUPER_ADMIN: [
      // All capabilities
      ...Object.keys(CAPABILITY_REGISTRY),
    ],

    SYSTEM_ADMIN: [
      // All capabilities
      ...Object.keys(CAPABILITY_REGISTRY),
    ],

    DEVELOPER: [
      // All capabilities
      ...Object.keys(CAPABILITY_REGISTRY),
    ],

    PATIENT: [
      "clinical.appointments.manage",
    ],
  };

  const normalizedRole = normalizeRole(role || "");
  const roleAliases = {
    SURGEON: "DOCTOR",
    THERAPIST: "DOCTOR",
    RADIOLOGIST: "DOCTOR",
    COMMUNITY_HEALTH_WORKER: "RECEPTIONIST",
    GOVERNMENT_ADMIN: "SYSTEM_ADMIN",
    GOVERNMENT_REGULATOR: "SYSTEM_ADMIN",
    GOVERNMENT_AUDITOR: "SYSTEM_ADMIN",
    GOVERNMENT_INSPECTOR: "SYSTEM_ADMIN",
    GOVERNMENT_ANALYST: "SYSTEM_ADMIN",
    SUPER_ASSISTANT: "SYSTEM_ADMIN",
    GUEST: "PATIENT",
  };
  const sourceRole = roleAliases[normalizedRole] || normalizedRole;

  return roleCapabilityMap[sourceRole] || [];
}

/**
 * Get capability metadata
 */
export function getCapability(capabilityId) {
  return CAPABILITY_REGISTRY[capabilityId] || null;
}

/**
 * Get all capabilities for a role with metadata
 */
export function getCapabilitiesWithMetadataForRole(role) {
  const capabilityIds = getCapabilitiesForRole(role);
  return capabilityIds
    .map((id) => ({
      id,
      ...getCapability(id),
    }))
    .filter((cap) => cap.id); // Remove null entries
}

/**
 * Check if a role has a specific capability
 */
export function roleHasCapability(role, capabilityId) {
  return getCapabilitiesForRole(role).includes(capabilityId);
}

/**
 * Get capabilities grouped by category
 */
export function getCapabilitiesByCategory(role) {
  const capabilities = getCapabilitiesWithMetadataForRole(role);
  return capabilities.reduce((acc, cap) => {
    const category = cap.category || "Other";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(cap);
    return acc;
  }, {});
}

/**
 * Get capabilities grouped by module
 */
export function getCapabilitiesByModule(role) {
  const capabilities = getCapabilitiesWithMetadataForRole(role);
  return capabilities.reduce((acc, cap) => {
    const module = cap.module || "Other";
    if (!acc[module]) {
      acc[module] = [];
    }
    acc[module].push(cap);
    return acc;
  }, {});
}
