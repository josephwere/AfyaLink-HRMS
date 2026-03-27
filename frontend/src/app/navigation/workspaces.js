import { normalizeRole } from "../../utils/normalizeRole";

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
  people: "/app/people/home/index",
  platform: "/app/platform/home/index",
  governance: "/app/governance/home/index",
  portal: "/app/portal/home/index",
  innovation: "/app/innovation/home/index",
});

// Workspaces visible per effective role. (Auth provider already applies roleOverride.)
const WORKSPACES_BY_ROLE = Object.freeze({
  SUPER_ADMIN: ["care", "operations", "revenue", "people", "platform", "governance", "innovation", "portal"],
  DEVELOPER: ["platform", "governance", "operations", "care", "innovation"],
  SYSTEM_ADMIN: ["governance", "platform", "revenue", "operations", "care", "innovation"],
  SUPER_ASSISTANT: ["platform", "governance", "care"],

  HOSPITAL_ADMIN: ["operations", "people", "revenue", "care", "platform", "innovation"],
  HOSPITAL_ADMIN_ASSISTANT: ["operations", "people", "revenue", "care", "platform", "innovation"],

  DOCTOR: ["care", "operations", "people", "innovation"],
  SURGEON: ["care", "operations", "people", "innovation"],
  NURSE: ["care", "operations", "people"],
  RADIOLOGIST: ["care", "operations", "people"],
  THERAPIST: ["care", "operations", "people"],

  LAB_TECH: ["operations", "care"],
  PHARMACIST: ["operations", "care"],
  RECEPTIONIST: ["operations", "revenue", "people"],
  COMMUNITY_HEALTH_WORKER: ["operations", "care"],

  HR_MANAGER: ["people", "operations", "platform"],
  PAYROLL_OFFICER: ["revenue", "people"],

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
        { id: "gov-registry-hosp", label: "Hospital Registry", path: "/app/governance/registry/hospitals", icon: "admin" },
        { id: "gov-registry-patient", label: "Patient Identity", path: "/app/governance/registry/patient-identity", icon: "account" },
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

export function workspacesForUser(user) {
  const role = normalizeRole(user?.role || "");
  const list = WORKSPACES_BY_ROLE[role] || [];
  return list
    .map((id) => WORKSPACES.find((w) => w.id === id))
    .filter(Boolean);
}

export function navForWorkspace(workspaceId) {
  return WORKSPACE_NAV[workspaceId] || [];
}
