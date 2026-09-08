import { normalizeRole } from "../../utils/normalizeRole";
import { getRuntimeNavigationItems } from "../../services/shared/frontendRuntime";
import { getStoredUserContextMode } from "../../contexts/UserContextContext";

/**
 * Single source of truth for:
 * - workspace navigation (Sidebar)
 * - global destinations (Command Palette)
 *
 * Hard rules enforced:
 * - One AppShell
 * - One navigation model
 * - Canonical route format: /app/:workspace/:module/:page
 */

export const WORKSPACES = [
  { id: "care", label: "Care", icon: "doctor" },
  { id: "operations", label: "Operations", icon: "appointments" },
  { id: "revenue", label: "Revenue", icon: "payroll" },
  { id: "finance", label: "Finance", icon: "bank" },
  { id: "people", label: "People", icon: "staff" },
  { id: "platform", label: "Platform", icon: "settings" },
  { id: "governance", label: "Governance", icon: "shield" },
  { id: "portal", label: "Patient Portal", icon: "account" },
  { id: "innovation", label: "Innovation Lab", icon: "ai" },
];

export const WORKSPACE_HOME_PATH = Object.freeze({
  care: "/app/care/home/index",
  operations: "/app/operations/home/index",
  revenue: "/app/revenue/home/index",
  finance: "/app/finance/home/index",
  people: "/app/people/home/index",
  platform: "/app/platform/home/index",
  governance: "/app/governance/home/index",
  portal: "/app/portal/home/index",
  innovation: "/app/innovation/home/index",
});

const SHARED_CALENDAR_ROUTE = "/app/operations/scheduling/my-schedule";

const FINANCE_ROUTE_MATRIX = Object.freeze({
  CASHIER: new Set([
    "fin-workcenter",
    "fin-home",
    "fin-cashier",
    "fin-billing",
    "fin-payments",
    "fin-receipts",
    "fin-refunds",
  ]),
  ACCOUNTANT: new Set([
    "fin-home",
    "fin-workcenter",
    "fin-accounting",
    "fin-ledger",
    "fin-journals",
    "fin-chart-of-accounts",
    "fin-periods",
    "fin-reconciliation",
    "fin-approvals",
    "fin-settings",
  ]),
  FINANCE_MANAGER: new Set([
    "fin-home",
    "fin-workcenter",
    "fin-manager",
    "fin-executive",
    "fin-accounting",
    "fin-ledger",
    "fin-reconciliation",
    "fin-approvals",
    "fin-audit",
    "fin-settings",
  ]),
  CFO: new Set([
    "fin-home",
    "fin-workcenter",
    "fin-executive",
    "fin-accounting",
    "fin-reconciliation",
    "fin-approvals",
    "fin-audit",
    "fin-settings",
  ]),
  HOSPITAL_ADMIN: new Set([
    "fin-workcenter",
    "fin-home",
    "fin-executive",
    "fin-billing",
    "fin-cashier",
    "fin-payments",
    "fin-receipts",
    "fin-refunds",
    "fin-insurance",
    "fin-accounting",
    "fin-ledger",
    "fin-journals",
    "fin-chart-of-accounts",
    "fin-periods",
    "fin-reconciliation",
    "fin-audit",
    "fin-approvals",
    "fin-settings",
  ]),
  HOSPITAL_ADMIN_ASSISTANT: new Set([
    "fin-workcenter",
    "fin-home",
    "fin-billing",
    "fin-cashier",
    "fin-payments",
    "fin-receipts",
    "fin-refunds",
  ]),
  RECEPTIONIST: new Set([
    "fin-workcenter",
    "fin-home",
    "fin-cashier",
    "fin-billing",
    "fin-payments",
    "fin-receipts",
    "fin-refunds",
  ]),
  PAYROLL_OFFICER: new Set([
    "fin-workcenter",
    "fin-home",
    "fin-billing",
    "fin-payments",
    "fin-receipts",
    "fin-refunds",
  ]),
  SUPER_ADMIN: new Set([
    "fin-workcenter",
    "fin-home",
    "fin-executive",
    "fin-billing",
    "fin-cashier",
    "fin-payments",
    "fin-receipts",
    "fin-refunds",
    "fin-insurance",
    "fin-accounting",
    "fin-ledger",
    "fin-journals",
    "fin-chart-of-accounts",
    "fin-periods",
    "fin-reconciliation",
    "fin-audit",
    "fin-approvals",
    "fin-settings",
  ]),
  SYSTEM_ADMIN: new Set([
    "fin-workcenter",
    "fin-home",
    "fin-executive",
    "fin-billing",
    "fin-cashier",
    "fin-payments",
    "fin-receipts",
    "fin-refunds",
    "fin-insurance",
    "fin-accounting",
    "fin-ledger",
    "fin-journals",
    "fin-chart-of-accounts",
    "fin-periods",
    "fin-reconciliation",
    "fin-audit",
    "fin-approvals",
    "fin-settings",
  ]),
  DEVELOPER: new Set([
    "fin-workcenter",
    "fin-home",
    "fin-executive",
    "fin-billing",
    "fin-cashier",
    "fin-payments",
    "fin-receipts",
    "fin-refunds",
    "fin-insurance",
    "fin-accounting",
    "fin-ledger",
    "fin-journals",
    "fin-chart-of-accounts",
    "fin-periods",
    "fin-reconciliation",
    "fin-audit",
    "fin-approvals",
    "fin-settings",
  ]),
  DEFAULT: new Set(["fin-home", "fin-workcenter"]),
});

function getFinanceItemIdsForRole(role) {
  const normalizedRole = normalizeRole(role || "");
  return FINANCE_ROUTE_MATRIX[normalizedRole] || FINANCE_ROUTE_MATRIX.DEFAULT;
}

function calendarGroupForWorkspace(workspaceId) {
  return {
    group: "Calendar",
    items: [
      {
        id: `${workspaceId}-calendar`,
        label: "Calendar",
        path: SHARED_CALENDAR_ROUTE,
        icon: "appointments",
      },
    ],
  };
}

export function getContextualWorkspaceHomePath(mode = "WORK") {
  if (mode === "MY_HEALTH") return "/app/portal/home/index";
  return WORKSPACE_HOME_PATH.portal;
}

// Workspaces visible per effective role. (Auth provider already applies roleOverride.)
const WORKSPACES_BY_ROLE = Object.freeze({
  SUPER_ADMIN: ["care", "operations", "revenue", "people", "platform", "governance", "innovation", "portal"],
  DEVELOPER: ["platform", "governance", "operations", "care", "innovation"],
  SYSTEM_ADMIN: ["governance", "platform", "revenue", "operations", "care", "innovation"],
  SUPER_ASSISTANT: ["platform", "governance", "care"],

  HOSPITAL_ADMIN: ["operations", "people", "revenue", "finance", "care", "platform", "innovation"],
  HOSPITAL_ADMIN_ASSISTANT: ["operations", "people", "revenue", "finance", "care", "platform", "innovation"],
  RECEPTIONIST: ["operations", "people", "revenue", "finance", "care"],
  PAYROLL_OFFICER: ["revenue", "finance", "people"],
  ACCOUNTANT: ["finance"],
  FINANCE_MANAGER: ["finance"],
  CFO: ["finance"],

  DOCTOR: ["care", "operations", "people", "innovation"],
  SURGEON: ["care", "operations", "people", "innovation"],
  NURSE: ["care", "operations", "people"],
  RADIOLOGIST: ["care", "operations", "people"],
  THERAPIST: ["care", "operations", "people"],

  LAB_TECH: ["operations", "care"],
  PHARMACIST: ["operations", "care"],
  SUPPLIER: ["operations"],
  COMMUNITY_HEALTH_WORKER: ["operations", "care"],
  DRIVER: ["operations"],
  AMBULANCE_DRIVER: ["operations"],
  MORTUARY_STAFF: ["operations"],
  MORTUARY_MANAGER: ["operations"],

  HR_MANAGER: ["people", "operations", "platform"],

  SECURITY_ADMIN: ["platform", "operations"],
  SECURITY_OFFICER: ["platform", "operations"],

  GOVERNMENT_ADMIN: ["governance", "platform", "revenue"],
  GOVERNMENT_REGULATOR: ["governance", "platform", "revenue"],
  GOVERNMENT_AUDITOR: ["governance", "platform", "revenue"],
  GOVERNMENT_INSPECTOR: ["governance", "platform", "revenue"],
  GOVERNMENT_ANALYST: ["governance", "platform", "revenue"],

  PATIENT: ["portal"],
  GUEST: ["portal"],
});

/**
 * Canonical navigation tree.
 * Keep it small and worklist-first: queues > forms.
 */
const MY_HEALTH_WORKSPACE_NAV = Object.freeze({
  portal: [
    {
      group: "My Health",
      items: [
        { id: "portal-home", label: "Home", path: "/app/portal/home/index", icon: "home" },
        { id: "portal-discovery", label: "Discover Care", path: "/app/portal/discovery/hospitals", icon: "hospital" },
        { id: "portal-appointments", label: "My Appointments", path: "/app/portal/appointments/index", icon: "appointments" },
        { id: "portal-records", label: "Medical Records", path: "/app/portal/records/index", icon: "reports" },
        { id: "portal-prescriptions", label: "Prescriptions", path: "/app/portal/medications/prescriptions", icon: "pharmacy" },
        { id: "portal-billing", label: "Payments", path: "/app/portal/billing/index", icon: "payroll" },
        { id: "portal-insurance", label: "Insurance", path: "/app/portal/insurance/index", icon: "shield" },
        { id: "portal-support", label: "Telemedicine", path: "/app/portal/support/feedback", icon: "notifications" },
      ],
    },
  ],
});

export const WORKSPACE_NAV = Object.freeze({
  care: [
    {
      group: "Care",
      items: [
        { id: "care-home", label: "Home", path: "/app/care/home/index", icon: "home" },
        { id: "care-patients", label: "Patients", path: "/app/care/patients/index", icon: "staff" },
        { id: "care-opd", label: "OPD Workspace", path: "/app/care/encounters/opd", icon: "doctor" },
        { id: "care-inpatient", label: "Inpatient Ward", path: "/app/care/encounters/inpatient", icon: "staff" },
        { id: "care-referrals", label: "Referrals", path: "/app/care/referrals/index", icon: "reports" },
        { id: "care-transfers", label: "Transfers", path: "/app/care/transfers/index", icon: "requests" },
      ],
    },
    {
      group: "Clinical",
      items: [
        { id: "care-prescriptions", label: "Prescriptions", path: "/app/care/medications/prescriptions", icon: "pharmacy" },
        { id: "care-labs", label: "Lab Results", path: "/app/care/diagnostics/lab-results", icon: "lab" },
        { id: "care-records", label: "Medical Records", path: "/app/care/records/index", icon: "reports" },
        { id: "care-intelligence", label: "Clinical Intelligence", path: "/app/care/intelligence/index", icon: "ai" },
      ],
    },
  ],
  operations: [
    {
      group: "Operations",
      items: [
        { id: "ops-home", label: "Home", path: "/app/operations/home/index", icon: "home" },
        { id: "ops-driver", label: "Driver Ops", path: "/app/operations/driver/home", icon: "car" },
        { id: "ops-mortuary", label: "Mortuary", path: "/app/operations/mortuary/home", icon: "hospital" },
        { id: "ops-bedboard", label: "Bed Board", path: "/app/operations/bed-board/index", icon: "analytics" },
        { id: "ops-triage", label: "Triage", path: "/app/operations/triage/index", icon: "appointments" },
        { id: "ops-emergency", label: "Emergency Command", path: "/app/operations/emergency/command", icon: "security" },
        { id: "ops-consults", label: "Consultation Monitor", path: "/app/operations/consultations/monitor", icon: "notifications" },
        { id: "ops-transfers", label: "Transfer Command", path: "/app/operations/transfers/command", icon: "requests" },
        { id: "ops-appts", label: "Appointments", path: "/app/operations/scheduling/appointments", icon: "appointments" },
        { id: "ops-booking", label: "Booking Desk", path: "/app/operations/front-desk/booking-desk", icon: "appointments" },
      ],
    },
    {
      group: "Diagnostics",
      items: [
        { id: "ops-lab-queue", label: "Lab Test Queue", path: "/app/operations/lab/test-queue", icon: "lab" },
        { id: "ops-lab-encounters", label: "Encounter Lab Queue", path: "/app/operations/lab/encounter-queue", icon: "lab" },
        { id: "ops-lab-samples", label: "Sample Tracking", path: "/app/operations/lab/samples", icon: "lab" },
        { id: "ops-lab-qc", label: "Quality Control", path: "/app/operations/lab/qc", icon: "lab" },
      ],
    },
    {
      group: "Pharmacy",
      items: [
        { id: "ops-rx-queue", label: "Prescription Queue", path: "/app/operations/pharmacy/prescription-queue", icon: "pharmacy" },
        { id: "ops-pharm-inv", label: "Inventory", path: "/app/operations/pharmacy/inventory", icon: "inventory" },
        { id: "ops-pharm-suppliers", label: "Procurement", path: "/app/operations/pharmacy/suppliers", icon: "reports" },
        { id: "ops-pharm-controlled", label: "Controlled Drugs", path: "/app/operations/pharmacy/controlled", icon: "security" },
      ],
    },
  ],
  revenue: [
    {
      group: "Revenue",
      items: [
        { id: "rev-home", label: "Home", path: "/app/revenue/home/index", icon: "home" },
        { id: "rev-payments", label: "Payments", path: "/app/revenue/payments/index", icon: "payroll" },
        { id: "rev-transactions", label: "Transactions", path: "/app/revenue/transactions/index", icon: "reports" },
        { id: "rev-claims", label: "Claims", path: "/app/revenue/claims/index", icon: "reports" },
        { id: "rev-intel", label: "Revenue Intelligence", path: "/app/revenue/intelligence/index", icon: "analytics" },
      ],
    },
  ],
  finance: [
    {
      group: "Finance",
      items: [
        { id: "fin-workcenter", label: "Work Center", path: "/app/finance/work-center", icon: "inbox" },
        { id: "fin-home", label: "Home", path: "/app/finance/home/index", icon: "home" },
        { id: "fin-manager", label: "Manager Dashboard", path: "/app/finance/manager/index", icon: "analytics" },
        { id: "fin-executive", label: "Executive Dashboard", path: "/app/finance/executive/index", icon: "analytics" },
      ],
    },
    {
      group: "Revenue Cycle",
      items: [
        { id: "fin-billing", label: "Patient Billing", path: "/app/finance/billing/index", icon: "payroll" },
        { id: "fin-cashier", label: "Cashier", path: "/app/finance/cashier/index", icon: "payments" },
        { id: "fin-payments", label: "Payments", path: "/app/finance/payments/index", icon: "payments" },
        { id: "fin-receipts", label: "Receipts", path: "/app/finance/receipts/index", icon: "payments" },
        { id: "fin-refunds", label: "Refunds", path: "/app/finance/refunds/index", icon: "refresh" },
        { id: "fin-insurance", label: "Insurance Claims", path: "/app/finance/insurance-claims/index", icon: "shield" },
      ],
    },
    {
      group: "Accounting",
      items: [
        { id: "fin-accounting", label: "Accounting Dashboard", path: "/app/finance/accounting/index", icon: "ledger" },
        { id: "fin-ledger", label: "General Ledger", path: "/app/finance/general-ledger/index", icon: "analytics" },
        { id: "fin-journals", label: "Journal Entries", path: "/app/finance/journal-entries/index", icon: "reports" },
        { id: "fin-chart-of-accounts", label: "Chart of Accounts", path: "/app/finance/chart-of-accounts/index", icon: "chart" },
        { id: "fin-periods", label: "Accounting Periods", path: "/app/finance/periods/index", icon: "calendar" },
      ],
    },
    {
      group: "Reporting",
      items: [
        { id: "fin-reports", label: "Reports", path: "/app/finance/reports/index", icon: "analytics" },
        { id: "fin-trial-balance", label: "Trial Balance", path: "/app/finance/trial-balance/index", icon: "balance" },
        { id: "fin-profit-loss", label: "Profit & Loss", path: "/app/finance/profit-and-loss/index", icon: "analytics" },
        { id: "fin-balance-sheet", label: "Balance Sheet", path: "/app/finance/balance-sheet/index", icon: "analytics" },
        { id: "fin-cash-flow", label: "Cash Flow", path: "/app/finance/cash-flow/index", icon: "cash" },
        { id: "fin-finintel", label: "Financial Intelligence", path: "/app/finance/financial-intelligence/index", icon: "ai" },
      ],
    },
    {
      group: "Governance",
      items: [
        { id: "fin-reconciliation", label: "Reconciliation", path: "/app/finance/reconciliation/index", icon: "analytics" },
        { id: "fin-audit", label: "Audit", path: "/app/finance/audit/index", icon: "shield" },
        { id: "fin-approvals", label: "Approvals", path: "/app/finance/approvals/index", icon: "check" },
        { id: "fin-approval-policies", label: "Approval Policies", path: "/app/finance/approval-policies/index", icon: "policy" },
        { id: "fin-consolidation", label: "Consolidation", path: "/app/finance/consolidation/index", icon: "bank" },
        { id: "fin-settings", label: "Settings", path: "/app/finance/settings/index", icon: "settings" },
      ],
    },
  ],
  people: [
    {
      group: "People",
      items: [
        { id: "people-home", label: "Home", path: "/app/people/home/index", icon: "home" },
        { id: "people-requests", label: "Requests", path: "/app/people/requests/index", icon: "requests" },
        { id: "people-training", label: "Training Tracker", path: "/app/people/training/tracker", icon: "analytics" },
        { id: "people-staff", label: "Staff Directory", path: "/app/people/staff/index", icon: "staff" },
      ],
    },
  ],
  platform: [
    {
      group: "Account",
      slot: "global",
      items: [
        { id: "platform-profile", label: "Profile", path: "/app/platform/account/profile", icon: "account" },
        { id: "platform-notifs", label: "Notifications", path: "/app/platform/inbox/notifications", icon: "notifications" },
        { id: "platform-comm", label: "Communication Center", path: "/app/platform/inbox/communication", icon: "notifications" },
        { id: "platform-hospital-comm", label: "Hospital Communication Center", path: "/app/platform/inbox/hospital-communication", icon: "notifications" },
      ],
    },
    {
      group: "Platform",
      items: [
        { id: "platform-home", label: "Home", path: "/app/platform/home/index", icon: "home" },
        { id: "platform-settings", label: "System Settings", path: "/app/platform/settings/system", icon: "settings" },
        { id: "platform-compliance", label: "Compliance Center", path: "/app/platform/compliance/center", icon: "shield" },
        { id: "platform-integrations", label: "Integrations Hub", path: "/app/platform/integrations/hub", icon: "settings" },
        { id: "platform-offline", label: "Offline Ops", path: "/app/platform/offline/ops", icon: "inventory" },
        { id: "platform-print", label: "Print Center", path: "/app/platform/print/center", icon: "printer" },
        { id: "platform-audit", label: "Audit Logs", path: "/app/platform/audit/logs", icon: "security" },
      ],
    },
    {
      group: "Insights",
      items: [
        { id: "platform-analytics", label: "Analytics", path: "/app/platform/analytics/index", icon: "analytics" },
        { id: "platform-hospital-kpis", label: "Hospital KPIs", path: "/app/platform/analytics/hospital-kpis", icon: "analytics" },
        { id: "platform-reports", label: "Reports", path: "/app/platform/reports/index", icon: "reports" },
      ],
    },
  ],
  governance: [
    {
      group: "Governance",
      items: [
        { id: "gov-home", label: "Home", path: "/app/governance/home/index", icon: "home" },
        { id: "gov-claims", label: "Government Claims", path: "/app/governance/claims/index", icon: "reports" },
        { id: "gov-pharmacy-safety", label: "Medicine Safety", path: "/app/governance/pharmacy-safety", icon: "shield" },
        { id: "gov-registry-hosp", label: "Hospital Registry", path: "/app/governance/registry/hospitals", icon: "admin" },
        { id: "gov-registry-patient", label: "Patient Identity", path: "/app/governance/registry/patient-identity", icon: "account" },
        { id: "gov-verification", label: "Hospital Verification", path: "/app/governance/verification/hospitals", icon: "shield" },
      ],
    },
  ],
  portal: [
    {
      group: "My Health",
      items: [
        { id: "portal-home", label: "Home", path: "/app/portal/home/index", icon: "home" },
        { id: "portal-appointments", label: "Appointments", path: "/app/portal/appointments/index", icon: "appointments" },
        { id: "portal-records", label: "Medical Records", path: "/app/portal/records/index", icon: "reports" },
        { id: "portal-billing", label: "Billing", path: "/app/portal/billing/index", icon: "payroll" },
        { id: "portal-family", label: "Family Records", path: "/app/portal/family/records", icon: "account" },
      ],
    },
  ],
  innovation: [
    {
      group: "Innovation",
      items: [
        { id: "innov-home", label: "Home", path: "/app/innovation/home/index", icon: "home" },
        { id: "innov-medical", label: "Medical Assistant", path: "/app/innovation/ai/medical", icon: "ai" },
        { id: "innov-triage", label: "AI Triage", path: "/app/innovation/ai/triage", icon: "ai" },
        { id: "innov-voice", label: "Voice Dictation", path: "/app/innovation/ai/voice", icon: "ai" },
        { id: "innov-chat", label: "AI Chat", path: "/app/innovation/ai/chatbot", icon: "ai" },
        { id: "innov-extract", label: "Document Extract", path: "/app/innovation/ai/extract", icon: "ai" },
      ],
    },
  ],
});

function toWorkspaceLabel(id) {
  return id
    .split(/[-_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function workspacesForUser(user) {
  const role = normalizeRole(user?.role || "");
  const mode = getStoredUserContextMode();
  const roleWorkspaces = new Set(WORKSPACES_BY_ROLE[role] || []);
  const domainItems = getRuntimeNavigationItems({ userPermissions: user?.permissions || [] });

  domainItems.forEach((item) => {
    if (item.workspace) {
      roleWorkspaces.add(item.workspace);
    }
  });

  if (mode === "MY_HEALTH") {
    roleWorkspaces.clear();
    roleWorkspaces.add("portal");
  }

  return Array.from(roleWorkspaces)
    .map((id) => WORKSPACES.find((w) => w.id === id) || { id, label: toWorkspaceLabel(id), icon: "apps" })
    .filter(Boolean);
}

export function navForWorkspace(workspaceId, user = null) {
  const mode = getStoredUserContextMode();
  if (mode === "MY_HEALTH" && workspaceId === "portal") {
    return [...(MY_HEALTH_WORKSPACE_NAV[workspaceId] || []), calendarGroupForWorkspace(workspaceId)];
  }

  const staticNav = WORKSPACE_NAV[workspaceId] || [];
  const domainItems = getRuntimeNavigationItems({ userPermissions: user?.permissions || [] }).filter((item) => item.workspace === workspaceId);

  const baseNav = (() => {
    if (workspaceId !== "finance") {
      return [...staticNav, calendarGroupForWorkspace(workspaceId)];
    }

    const role = user?.role || "HOSPITAL_ADMIN";
    const allowedFinanceIds = getFinanceItemIdsForRole(role);
    const allowedItems = staticNav.flatMap((group) => (group.items || []).filter((item) => allowedFinanceIds.has(item.id)));

    if (allowedItems.length === 0) {
      return [{ group: "Finance", items: [] }, calendarGroupForWorkspace(workspaceId)];
    }

    return [{ group: "Finance", items: allowedItems }, calendarGroupForWorkspace(workspaceId)];
  })();

  if (!domainItems.length) {
    return baseNav;
  }

  const domainGroup = {
    group: "Domains",
    items: domainItems.map((item) => ({
      id: `domain-${item.id}`,
      label: item.label,
      path: item.route,
      icon: item.icon,
    })),
  };

  return [...baseNav, domainGroup];
}
