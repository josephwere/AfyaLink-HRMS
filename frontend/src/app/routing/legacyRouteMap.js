/**
 * Legacy route → canonical route mapping.
 * This is used to:
 * - redirect all old URLs into the new /app/:workspace/:module/:page system
 * - generate migration tables (design + engineering)
 *
 * Rule: all "app" features must live under /app/...
 */

export const LEGACY_ROUTE_MAP = Object.freeze({
  // Shared / account
  "/profile": "/app/platform/account/profile",
  "/notifications": "/app/platform/inbox/notifications",
  "/admin/notifications": "/app/platform/inbox/notifications",
  "/communication": "/app/platform/inbox/communication",
  "/analytics": "/app/platform/analytics/index",
  "/reports": "/app/platform/reports/index",
  "/inventory": "/app/operations/inventory/index",
  "/payments": "/app/revenue/payments/index",
  "/payments/full": "/app/revenue/payments/index",

  // AI (legacy)
  "/ai/medical": "/app/innovation/ai/medical",
  "/ai/triage": "/app/innovation/ai/triage",
  "/ai/voice": "/app/innovation/ai/voice",
  "/ai/chatbot": "/app/innovation/ai/chatbot",
  "/ai/extract": "/app/innovation/ai/extract",

  // Portal (patient + guest)
  "/patient": "/app/portal/home/index",
  "/guest": "/app/portal/home/index",
  "/patient/appointments": "/app/portal/appointments/index",
  "/patient/medical-records": "/app/portal/records/index",
  "/patient/family-records": "/app/portal/family/records",
  "/patient/family-timeline": "/app/portal/family/timeline",
  "/patient/prescriptions": "/app/portal/medications/prescriptions",
  "/patient/lab-results": "/app/portal/diagnostics/lab-results",
  "/patient/billing": "/app/portal/billing/index",
  "/patient/insurance": "/app/portal/insurance/index",
  "/patient/transfers": "/app/portal/transfers/index",
  "/patient/hospitals": "/app/portal/discovery/hospitals",
  "/patient/feedback": "/app/portal/support/feedback",
  "/patient/ads": "/app/portal/discovery/ads",

  // Care roles
  "/doctor": "/app/care/home/index",
  "/surgeon": "/app/care/home/index",
  "/nurse": "/app/care/home/index",
  "/radiologist": "/app/care/home/index",
  "/therapist": "/app/care/home/index",

  "/doctor/appointments": "/app/operations/scheduling/appointments",
  "/doctor/schedule": "/app/operations/scheduling/my-schedule",
  "/doctor/patients": "/app/care/patients/index",
  "/doctor/opd": "/app/care/encounters/opd",
  "/doctor/ward": "/app/care/encounters/inpatient",
  "/doctor/surgery": "/app/care/encounters/surgery",
  "/doctor/lab-results": "/app/care/diagnostics/lab-results",
  "/doctor/prescriptions": "/app/care/medications/prescriptions",
  "/doctor/medical-records": "/app/care/records/index",
  "/doctor/referrals": "/app/care/referrals/index",
  "/doctor/transfers": "/app/care/transfers/index",
  "/doctor/escalations": "/app/care/escalations/index",
  "/doctor/reports-notes": "/app/care/notes/index",
  "/doctor/settings": "/app/platform/account/clinician-settings",
  "/doctor/leave": "/app/people/requests/leave",
  "/doctor/performance": "/app/people/performance/index",
  "/doctor/cme": "/app/people/training/cme",
  "/doctor/ward-board": "/app/operations/bed-board/index",
  "/doctor/clinical-order-copilot": "/app/innovation/copilot/clinical-order",

  "/nurse/shift": "/app/people/schedule/shift",
  "/nurse/patients": "/app/care/patients/index",
  "/nurse/medication": "/app/care/medication/administration",
  "/nurse/incidents": "/app/operations/incidents/index",
  "/nurse/vitals": "/app/care/vitals/entry",
  "/nurse/leave": "/app/people/requests/leave",
  "/nurse/performance": "/app/people/performance/index",
  "/nurse/ward-board": "/app/operations/bed-board/index",

  // Operations roles
  "/hospital-admin": "/app/operations/home/index",
  "/hospitaladmin": "/app/operations/home/index",
  "/receptionist": "/app/operations/home/index",
  "/community-health-worker": "/app/operations/home/index",
  "/lab-tech": "/app/operations/home/index",
  "/pharmacy": "/app/operations/home/index",

  "/receptionist/booking-desk": "/app/operations/front-desk/booking-desk",

  "/hospital-admin/register-staff": "/app/people/staff/register",
  "/hospital-admin/approvals": "/app/people/approvals/index",
  "/hospital-admin/staff": "/app/people/staff/index",
  "/hospital-admin/staff-transfers": "/app/people/staff/transfers",
  "/hospital-admin/transfer-command-center": "/app/operations/transfers/command",
  "/hospital-admin/ward-board": "/app/operations/bed-board/index",
  "/hospital-admin/appointments": "/app/operations/scheduling/appointments",
  "/hospital-admin/appointment-analytics": "/app/operations/scheduling/analytics",
  "/hospital-admin/consultation-monitor": "/app/operations/consultations/monitor",
  "/hospital-admin/escalations": "/app/operations/escalations/index",
  "/hospital-admin/machine-connectivity": "/app/operations/devices/connectivity",
  "/hospital-admin/machine-alerts": "/app/operations/devices/alerts",
  "/hospital-admin/claims": "/app/revenue/claims/index",
  "/hospital-admin/revenue-intelligence": "/app/revenue/intelligence/index",
  "/hospital-admin/commerce-config": "/app/revenue/commerce/config",
  "/hospital-admin/financials": "/app/revenue/financials/index",
  "/hospital-admin/recruitment-ads": "/app/people/recruitment/ads",
  "/hospital-admin/customization": "/app/platform/facility/customization",
  "/hospital-admin/pharmacy-referrals": "/app/operations/pharmacy/referrals",
  "/hospital-admin/clinical-order-copilot": "/app/innovation/copilot/clinical-order",
  "/hospital-admin/digital-twin": "/app/innovation/digital-twin/index",
  "/hospital-admin/interop-marketplace": "/app/innovation/interop-marketplace/index",

  // Ops unit dashboards (legacy)
  "/ops/triage": "/app/operations/triage/index",
  "/ops/emergency-command": "/app/operations/emergency/command",
  "/ops/icu": "/app/operations/units/icu",
  "/ops/theatre": "/app/operations/units/theatre",
  "/ops/imaging": "/app/operations/units/imaging",
  "/ops/neonatal-icu": "/app/operations/units/neonatal-icu",
  "/ops/dialysis": "/app/operations/units/dialysis",
  "/ops/oncology-daycare": "/app/operations/units/oncology-daycare",

  // Beds shared aliases
  "/admin/beds": "/app/operations/bed-board/index",
  "/nurse/ward-board": "/app/operations/bed-board/index",
  "/doctor/ward-board": "/app/operations/bed-board/index",
  "/hospital-admin/ward-board": "/app/operations/bed-board/index",

  // Lab tech pages
  "/lab-tech/test-queue": "/app/operations/lab/test-queue",
  "/lab-tech/equipment": "/app/operations/lab/equipment",
  "/lab-tech/samples": "/app/operations/lab/samples",
  "/lab-tech/qc": "/app/operations/lab/qc",
  "/lab-tech/safety": "/app/operations/lab/safety",
  "/lab-tech/archive": "/app/operations/lab/archive",
  "/labtech/labs": "/app/operations/lab/test-queue",

  // Pharmacy pages
  "/pharmacy/queue": "/app/operations/pharmacy/prescription-queue",
  "/pharmacy/inventory": "/app/operations/pharmacy/inventory",
  "/pharmacy/controlled": "/app/operations/pharmacy/controlled",
  "/pharmacy/expiry": "/app/operations/pharmacy/expiry",
  "/pharmacy/suppliers": "/app/operations/pharmacy/suppliers",
  "/pharmacy/reports": "/app/operations/pharmacy/reports",

  // People
  "/hr-manager": "/app/people/home/index",
  "/payroll-officer": "/app/people/home/index",
  "/workforce/requests": "/app/people/requests/index",
  "/staff": "/app/people/home/index",

  // Security
  "/security-officer": "/app/platform/security/officer/home",
  "/security-admin": "/app/platform/security/admin/home",

  // Platform / admin tools
  "/admin": "/app/platform/admin/home",
  "/admin/audit-logs": "/app/platform/audit/logs",
  "/admin/ai-autofill-audit": "/app/platform/ai/autofill-audit",
  "/admin/realtime": "/app/platform/integrations/realtime",
  "/admin/crdt-patients": "/app/platform/data/crdt/patients",
  "/admin/access-control": "/app/platform/security/access-control",
  "/admin/payment-settings": "/app/revenue/payments/settings",
  "/admin/create-admin": "/app/platform/security/admin-creation",
  "/admin/super-assistants": "/app/platform/ai/super-assistants",
  "/admin/training-tracker": "/app/people/training/tracker",
  "/admin/training-playbook": "/app/people/training/playbook",
  "/admin/launch-readiness": "/app/platform/rollout/launch-readiness",
  "/admin/sre-incidents": "/app/platform/sre/incidents",
  "/admin/support-tickets": "/app/platform/support/tickets",
  "/admin/pilot-onboarding": "/app/platform/rollout/pilot-onboarding",
  "/admin/print-center": "/app/platform/print/center",
  "/admin/offline-ops": "/app/platform/offline/ops",

  // Developer
  "/developer": "/app/platform/dev/home",
  "/developer/queue-replay": "/app/platform/queues/replay",
  "/developer/webhook-retry": "/app/platform/integrations/webhook-retry",
  "/developer/decision-cockpit": "/app/platform/trust/decision-cockpit",
  "/developer/provenance-verify": "/app/platform/trust/provenance",
  "/developer/ai-extraction-history": "/app/platform/ai/extraction-history",

  // Founder / admin
  "/super-admin": "/app/platform/home/index",
  "/superadmin": "/app/platform/home/index",
  "/super-admin/hospitals": "/app/governance/registry/hospitals",
  "/super-admin/settings": "/app/platform/settings/system",
  "/super-admin/pharmacies": "/app/governance/registry/pharmacies",

  // System admin / governance
  "/system-admin": "/app/governance/home/index",
  "/system-admin/abac": "/app/platform/security/abac",
  "/system-admin/mapping-studio": "/app/platform/integrations/mapping-studio",
  "/system-admin/nlp-analytics": "/app/platform/ai/nlp-analytics",
  "/system-admin/regulatory-reports": "/app/governance/reports/regulatory",
  "/system-admin/compliance-center": "/app/platform/compliance/center",
  "/system-admin/revenue-intelligence": "/app/revenue/intelligence/index",
  "/system-admin/clinical-intelligence": "/app/care/intelligence/index",
  "/system-admin/migrations": "/app/platform/migrations/index",
  "/system-admin/integration-hub": "/app/platform/integrations/hub",
  "/system-admin/integration-control-plane": "/app/platform/integrations/control-plane",
  "/system-admin/county-command-center": "/app/governance/command/county",
  "/system-admin/connector-sdk": "/app/platform/integrations/connector-sdk",
  "/system-admin/pharmacy-access-audit": "/app/platform/audit/pharmacy-access",
  "/system-admin/government-hospital-registry": "/app/governance/registry/hospitals",
  "/system-admin/patient-identity-registry": "/app/governance/registry/patient-identity",
  "/system-admin/claim-rules": "/app/revenue/claims/rules",
  "/system-admin/hospital-verification-review": "/app/governance/verification/hospitals",
  "/system-admin/fraud-guard": "/app/governance/fraud/index",
  "/system-admin/government-claims": "/app/governance/claims/index",
  "/system-admin/unified-assistant": "/app/platform/ai/unified-assistant",
  "/system-admin/clinical-order-copilot": "/app/innovation/copilot/clinical-order",
  "/system-admin/digital-hospital-twin": "/app/innovation/digital-twin/index",
  "/system-admin/interop-marketplace": "/app/innovation/interop-marketplace/index",
});

export function legacyMigrationRows() {
  return Object.entries(LEGACY_ROUTE_MAP)
    .map(([from, to]) => ({ from, to }))
    .sort((a, b) => a.from.localeCompare(b.from));
}
