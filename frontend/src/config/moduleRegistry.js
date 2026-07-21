import { canManageBeds, canManageRooms, canManageWards, canManageStaff, canCreateAppointments } from "../utils/permissions";

/**
 * Module Registry
 * Declares all modules in the system with their capabilities, routes, and UI elements
 * Used to build dynamic navigation, dashboards, and search
 */

export const MODULE_REGISTRY = {
  Facility: {
    id: "facility",
    name: "Facility Management",
    icon: "Building",
    description: "Manage hospital physical infrastructure",
    category: "Operations",
    order: 1,
    capabilities: [
      "facility.beds.view",
      "facility.beds.manage",
      "facility.wards.view",
      "facility.wards.manage",
      "facility.rooms.view",
      "facility.rooms.manage",
      "facility.buildings.view",
      "facility.buildings.manage",
      "facility.maintenance.view",
    ],
    navigationItems: [
      {
        id: "facility-beds",
        title: "Beds",
        description: "Manage hospital beds",
        icon: "Bed",
        route: "/facility/beds",
        requiredCapability: "facility.beds.manage",
        quickAction: "Add Bed",
      },
      {
        id: "facility-wards",
        title: "Wards",
        description: "Manage hospital wards",
        icon: "Hospital",
        route: "/facility/wards",
        requiredCapability: "facility.wards.manage",
        quickAction: "Add Ward",
      },
      {
        id: "facility-rooms",
        title: "Rooms",
        description: "Manage hospital rooms",
        icon: "Door",
        route: "/facility/rooms",
        requiredCapability: "facility.rooms.manage",
        quickAction: "Add Room",
      },
      {
        id: "facility-buildings",
        title: "Buildings",
        description: "Manage hospital buildings",
        icon: "Building2",
        route: "/facility/buildings",
        requiredCapability: "facility.buildings.manage",
      },
    ],
    dashboardWidgets: [
      {
        id: "facility-summary",
        title: "Facility Summary",
        description: "Overview of beds, wards, and occupancy",
        requiredCapability: "facility.beds.view",
      },
      {
        id: "bed-occupancy",
        title: "Bed Occupancy",
        description: "Live bed occupancy rates",
        requiredCapability: "facility.beds.view",
      },
    ],
  },

  Administration: {
    id: "administration",
    name: "User Management",
    icon: "Users",
    description: "Manage staff and access control",
    category: "Operations",
    order: 2,
    capabilities: [
      "users.view",
      "users.manage",
      "users.roles.assign",
      "users.shifts.manage",
    ],
    navigationItems: [
      {
        id: "admin-staff",
        title: "Staff",
        description: "Manage hospital staff",
        icon: "Users",
        route: "/hospital-admin/staff",
        requiredCapability: "users.manage",
        quickAction: "Add Staff Member",
      },
      {
        id: "admin-shifts",
        title: "Shifts",
        description: "Manage staff shifts",
        icon: "Clock",
        route: "/hospital-admin/shifts",
        requiredCapability: "users.shifts.manage",
      },
    ],
    dashboardWidgets: [
      {
        id: "staff-summary",
        title: "Staff Summary",
        description: "Staff headcount and roles",
        requiredCapability: "users.view",
      },
    ],
  },

  Clinical: {
    id: "clinical",
    name: "Clinical Operations",
    icon: "Stethoscope",
    description: "Monitor clinical workflows",
    category: "Clinical",
    order: 3,
    capabilities: [
      "clinical.patients.view",
      "clinical.appointments.manage",
      "clinical.consultations.monitor",
      "clinical.transfers.manage",
    ],
    navigationItems: [
      {
        id: "clinical-appointments",
        title: "Appointments",
        description: "Schedule and manage appointments",
        icon: "Calendar",
        route: "/hospital-admin/appointments",
        requiredCapability: "clinical.appointments.manage",
        quickAction: "New Appointment",
      },
      {
        id: "clinical-consultations",
        title: "Consultations",
        description: "Monitor consultation queue",
        icon: "Phone",
        route: "/hospital-admin/consultation-monitor",
        requiredCapability: "clinical.consultations.monitor",
      },
      {
        id: "clinical-transfers",
        title: "Transfers",
        description: "Manage patient transfers",
        icon: "Share2",
        route: "/hospital-admin/transfer-command-center",
        requiredCapability: "clinical.transfers.manage",
      },
    ],
    dashboardWidgets: [
      {
        id: "clinical-summary",
        title: "Clinical Summary",
        description: "Today's admissions, discharges, emergencies",
        requiredCapability: "clinical.patients.view",
      },
      {
        id: "consultation-queue",
        title: "Consultation Queue",
        description: "Active consultations and wait times",
        requiredCapability: "clinical.consultations.monitor",
      },
    ],
  },

  Pharmacy: {
    id: "pharmacy",
    name: "Pharmacy",
    icon: "Pill",
    description: "Manage pharmacy operations",
    category: "Clinical",
    order: 4,
    capabilities: [
      "pharmacy.inventory.view",
      "pharmacy.inventory.manage",
      "pharmacy.dispensing",
      "pharmacy.oversight",
    ],
    navigationItems: [
      {
        id: "pharmacy-inventory",
        title: "Inventory",
        description: "Manage pharmacy stock",
        icon: "Package",
        route: "/hospital-admin/pharmacy-inventory",
        requiredCapability: "pharmacy.inventory.manage",
      },
      {
        id: "pharmacy-oversight",
        title: "Oversight",
        description: "Monitor pharmacy operations",
        icon: "BarChart3",
        route: "/hospital-admin/pharmacy-referrals",
        requiredCapability: "pharmacy.oversight",
      },
    ],
    dashboardWidgets: [
      {
        id: "pharmacy-stock",
        title: "Low Stock Alerts",
        description: "Medications running low",
        requiredCapability: "pharmacy.inventory.view",
      },
    ],
  },

  Laboratory: {
    id: "laboratory",
    name: "Laboratory",
    icon: "Microscope",
    description: "Manage laboratory operations",
    category: "Clinical",
    order: 5,
    capabilities: [
      "laboratory.results.view",
      "laboratory.orders.manage",
      "laboratory.oversight",
    ],
    navigationItems: [
      {
        id: "laboratory-oversight",
        title: "Lab Oversight",
        description: "Monitor lab queue and results",
        icon: "BarChart3",
        route: "/hospital-admin/laboratory-oversight",
        requiredCapability: "laboratory.oversight",
      },
    ],
    dashboardWidgets: [
      {
        id: "lab-queue",
        title: "Lab Queue",
        description: "Pending and completed tests",
        requiredCapability: "laboratory.results.view",
      },
    ],
  },

  Radiology: {
    id: "radiology",
    name: "Radiology",
    icon: "Image",
    description: "Manage radiology operations",
    category: "Clinical",
    order: 6,
    capabilities: [
      "radiology.studies.view",
      "radiology.orders.manage",
      "radiology.oversight",
    ],
    navigationItems: [
      {
        id: "radiology-oversight",
        title: "Radiology Oversight",
        description: "Monitor imaging queue",
        icon: "BarChart3",
        route: "/hospital-admin/radiology-oversight",
        requiredCapability: "radiology.oversight",
      },
    ],
    dashboardWidgets: [
      {
        id: "radiology-queue",
        title: "Imaging Queue",
        description: "Pending and completed studies",
        requiredCapability: "radiology.studies.view",
      },
    ],
  },

  Finance: {
    id: "finance",
    name: "Financial Operations",
    icon: "DollarSign",
    description: "Manage billing and revenue",
    category: "Finance",
    order: 7,
    capabilities: [
      "finance.billing.view",
      "finance.billing.manage",
      "finance.claims.view",
      "finance.claims.manage",
      "finance.revenue.view",
    ],
    navigationItems: [
      {
        id: "finance-billing",
        title: "Billing",
        description: "Manage invoices and bills",
        icon: "DollarSign",
        route: "/hospital-admin/billing",
        requiredCapability: "finance.billing.manage",
      },
      {
        id: "finance-claims",
        title: "Claims",
        description: "Manage insurance claims",
        icon: "FileText",
        route: "/hospital-admin/claims",
        requiredCapability: "finance.claims.manage",
      },
      {
        id: "finance-revenue",
        title: "Revenue",
        description: "View revenue and reports",
        icon: "TrendingUp",
        route: "/hospital-admin/financials",
        requiredCapability: "finance.revenue.view",
      },
    ],
    dashboardWidgets: [
      {
        id: "finance-summary",
        title: "Revenue Summary",
        description: "Today's revenue and outstanding claims",
        requiredCapability: "finance.revenue.view",
      },
    ],
  },

  Security: {
    id: "security",
    name: "Emergency & Security",
    icon: "AlertTriangle",
    description: "Manage security and emergency access",
    category: "Operations",
    order: 8,
    capabilities: [
      "emergency.override.activate",
      "emergency.override.review",
      "security.access.view",
    ],
    navigationItems: [
      {
        id: "security-emergency",
        title: "Emergency Center",
        description: "Manage emergency overrides",
        icon: "AlertTriangle",
        route: "/hospital-admin/emergency-center",
        requiredCapability: "emergency.override.review",
      },
    ],
    dashboardWidgets: [
      {
        id: "security-overrides",
        title: "Active Overrides",
        description: "Emergency access sessions",
        requiredCapability: "emergency.override.review",
      },
    ],
  },

  Compliance: {
    id: "compliance",
    name: "Audit & Compliance",
    icon: "ClipboardList",
    description: "Audit and compliance tracking",
    category: "Governance",
    order: 9,
    capabilities: [
      "audit.logs.view",
      "audit.export",
    ],
    navigationItems: [
      {
        id: "compliance-audit",
        title: "Audit Logs",
        description: "View system audit trail",
        icon: "ClipboardList",
        route: "/hospital-admin/audit",
        requiredCapability: "audit.logs.view",
      },
    ],
    dashboardWidgets: [
      {
        id: "compliance-summary",
        title: "Compliance Summary",
        description: "Recent audit events",
        requiredCapability: "audit.logs.view",
      },
    ],
  },

  Analytics: {
    id: "analytics",
    name: "Analytics & Reporting",
    icon: "BarChart3",
    description: "View analytics and generate reports",
    category: "Insights",
    order: 10,
    capabilities: [
      "analytics.view",
      "reports.generate",
    ],
    navigationItems: [
      {
        id: "analytics-dashboard",
        title: "Analytics",
        description: "View operational analytics",
        icon: "BarChart3",
        route: "/hospital-admin/analytics",
        requiredCapability: "analytics.view",
      },
    ],
    dashboardWidgets: [],
  },
};

/**
 * Get module by ID
 */
export function getModule(moduleId) {
  return Object.values(MODULE_REGISTRY).find((m) => m.id === moduleId) || null;
}

/**
 * Get quick actions for a user with given capabilities
 */
export function getQuickActionsForCapabilities(capabilities = []) {
  const actions = [];

  Object.values(MODULE_REGISTRY).forEach((module) => {
    module.navigationItems?.forEach((item) => {
      const hasAccess = !item.requiredCapability || capabilities.includes(item.requiredCapability);
      if (item.quickAction && hasAccess) {
        const normalizedTitle = String(item.quickAction || "");
        const shouldKeep = (() => {
          if (normalizedTitle === "Add Bed") return canManageBeds({ capabilities });
          if (normalizedTitle === "Add Ward") return canManageWards({ capabilities });
          if (normalizedTitle === "Add Room") return canManageRooms({ capabilities });
          if (normalizedTitle === "Add Staff Member") return canManageStaff({ capabilities });
          if (normalizedTitle === "New Appointment") return canCreateAppointments({ capabilities });
          return true;
        })();

        if (!shouldKeep) return;

        actions.push({
          ...item,
          id: item.id,
          title: item.quickAction,
          description: item.description || `Open ${item.title}`,
          route: item.route,
          icon: item.icon,
          module: module.id,
          moduleName: module.name,
        });
      }
    });
  });

  return actions.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
}

/**
 * Get all navigation items for a user with given capabilities
 */
export function getNavigationItemsForCapabilities(capabilities = []) {
  const items = [];
  const capabilitySet = Array.isArray(capabilities) ? capabilities : [];

  Object.values(MODULE_REGISTRY).forEach((module) => {
    module.navigationItems?.forEach((item) => {
      const hasCapability = !item.requiredCapability || capabilitySet.includes(item.requiredCapability);
      if (hasCapability) {
        items.push({
          ...item,
          module: module.id,
          moduleName: module.name,
        });
      }
    });
  });

  if (items.length > 0) {
    return items;
  }

  return Object.values(MODULE_REGISTRY)
    .flatMap((module) =>
      (module.navigationItems || []).map((item) => ({
        ...item,
        module: module.id,
        moduleName: module.name,
      }))
    )
    .slice(0, 8);
}

/**
 * Get all dashboard widgets for a user with given capabilities
 */
export function getDashboardWidgetsForCapabilities(capabilities) {
  const widgets = [];

  Object.values(MODULE_REGISTRY).forEach((module) => {
    module.dashboardWidgets?.forEach((widget) => {
      if (widget.requiredCapability && capabilities.includes(widget.requiredCapability)) {
        widgets.push({
          ...widget,
          module: module.id,
          moduleName: module.name,
        });
      }
    });
  });

  return widgets;
}

/**
 * Get modules with available access for user
 */
export function getAvailableModulesForCapabilities(capabilities = []) {
  const capabilitySet = Array.isArray(capabilities) ? capabilities : [];
  const availableModules = Object.values(MODULE_REGISTRY).filter((module) => {
    return module.capabilities?.some((cap) => capabilitySet.includes(cap));
  });

  if (availableModules.length > 0) {
    return availableModules.sort((a, b) => a.order - b.order);
  }

  return Object.values(MODULE_REGISTRY)
    .slice(0, 5)
    .sort((a, b) => a.order - b.order);
}
