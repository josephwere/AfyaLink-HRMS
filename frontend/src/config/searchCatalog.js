import { normalizeRole } from "../utils/normalizeRole";

const BASE_ITEMS = [
  { label: "Dashboard Overview", path: "/" },
  { label: "Profile", path: "/profile" },
  { label: "Analytics", path: "/analytics" },
  { label: "Reports", path: "/reports" },
  { label: "Inventory", path: "/inventory" },
    { label: "Payments", path: "/payments" },
    { label: "Payment Operations", path: "/payments/full" },
    { label: "Payment Settings", path: "/admin/payment-settings" },
  { label: "AI Assistant", path: "/ai/medical" },
  { label: "AI Triage", path: "/ai/triage" },
  { label: "AI Voice Dictation", path: "/ai/voice" },
  { label: "AI Document Extract", path: "/ai/extract" },
  { label: "AI Chatbot", path: "/ai/chatbot" },
];

const ROLE_ITEMS = {
  SUPER_ADMIN: [
    { label: "Super Admin Dashboard", path: "/super-admin" },
    { label: "Manage Hospitals", path: "/super-admin/hospitals" },
    { label: "System Settings", path: "/super-admin/settings" },
    { label: "Admin Controls", path: "/admin" },
    { label: "Audit Logs", path: "/admin/audit-logs" },
    { label: "Integrations", path: "/admin/realtime" },
    { label: "System Admin Dashboard", path: "/system-admin" },
    { label: "Developer Console", path: "/developer" },
  ],
  SYSTEM_ADMIN: [
    { label: "System Admin Dashboard", path: "/system-admin" },
    { label: "ABAC Policies", path: "/system-admin/abac" },
    { label: "Mapping Studio", path: "/system-admin/mapping-studio" },
    { label: "NLP Analytics", path: "/system-admin/nlp-analytics" },
    { label: "Regulatory Reports", path: "/system-admin/regulatory-reports" },
    { label: "Clinical Intelligence", path: "/system-admin/clinical-intelligence" },
    { label: "Manage Hospitals", path: "/super-admin/hospitals" },
    { label: "Admin Controls", path: "/admin" },
    { label: "Audit Logs", path: "/admin/audit-logs" },
    { label: "Integrations", path: "/admin/realtime" },
  ],
  HOSPITAL_ADMIN: [
    { label: "Hospital Admin", path: "/hospital-admin" },
    { label: "Register Staff", path: "/hospital-admin/register-staff" },
    { label: "Approvals", path: "/hospital-admin/approvals" },
    { label: "Staff Management", path: "/hospital-admin/staff" },
    { label: "My Requests", path: "/workforce/requests" },
    { label: "Notifications", path: "/admin/notifications" },
    { label: "Offline Sync", path: "/admin/crdt-patients" },
    { label: "Clinical Intelligence", path: "/system-admin/clinical-intelligence" },
  ],
  DOCTOR: [
    { label: "Doctor Dashboard", path: "/doctor" },
    { label: "My Schedule", path: "/doctor/schedule" },
    { label: "My Patients", path: "/doctor/patients" },
    { label: "OPD Clinic", path: "/doctor/opd" },
    { label: "Inpatient Ward", path: "/doctor/ward" },
    { label: "Surgery / Procedures", path: "/doctor/surgery" },
    { label: "Lab Results", path: "/doctor/lab-results" },
    { label: "Prescriptions", path: "/doctor/prescriptions" },
    { label: "Medical Records", path: "/doctor/medical-records" },
    { label: "Referrals", path: "/doctor/referrals" },
    { label: "Performance", path: "/doctor/performance" },
    { label: "CME & Certifications", path: "/doctor/cme" },
    { label: "Leave Requests", path: "/doctor/leave" },
    { label: "Reports & Notes", path: "/doctor/reports-notes" },
    { label: "Doctor Settings", path: "/doctor/settings" },
    { label: "Appointments", path: "/doctor/appointments" },
    { label: "My Requests", path: "/workforce/requests" },
    { label: "Clinical Intelligence", path: "/system-admin/clinical-intelligence" },
  ],
  NURSE: [
    { label: "Nurse Dashboard", path: "/nurse" },
    { label: "My Shift", path: "/nurse/shift" },
    { label: "Assigned Patients", path: "/nurse/patients" },
    { label: "Medication Administration", path: "/nurse/medication" },
    { label: "Incident Reports", path: "/nurse/incidents" },
    { label: "Vitals Entry", path: "/nurse/vitals" },
    { label: "Leave Requests", path: "/nurse/leave" },
    { label: "Performance", path: "/nurse/performance" },
    { label: "My Requests", path: "/workforce/requests" },
    { label: "Clinical Intelligence", path: "/system-admin/clinical-intelligence" },
  ],
  LAB_TECH: [
    { label: "Lab Dashboard", path: "/lab-tech" },
    { label: "Test Queue", path: "/lab-tech/test-queue" },
    { label: "Equipment Logs", path: "/lab-tech/equipment" },
    { label: "Sample Tracking", path: "/lab-tech/samples" },
    { label: "Quality Control", path: "/lab-tech/qc" },
    { label: "Safety Checklist", path: "/lab-tech/safety" },
    { label: "Reports Archive", path: "/lab-tech/archive" },
    { label: "Lab Tests", path: "/labtech/labs" },
    { label: "My Requests", path: "/workforce/requests" },
  ],
  PHARMACIST: [
    { label: "Pharmacy", path: "/pharmacy" },
    { label: "Prescription Queue", path: "/pharmacy/queue" },
    { label: "Inventory", path: "/pharmacy/inventory" },
    { label: "Controlled Drugs", path: "/pharmacy/controlled" },
    { label: "Expiry Alerts", path: "/pharmacy/expiry" },
    { label: "Supplier Orders", path: "/pharmacy/suppliers" },
    { label: "Pharmacy Reports", path: "/pharmacy/reports" },
    { label: "My Requests", path: "/workforce/requests" },
  ],
  HR_MANAGER: [
    { label: "HR Manager", path: "/hr-manager" },
    { label: "My Requests", path: "/workforce/requests" },
    { label: "Clinical Intelligence", path: "/system-admin/clinical-intelligence" },
  ],
  PAYROLL_OFFICER: [
    { label: "Payroll Officer", path: "/payroll-officer" },
    { label: "My Requests", path: "/workforce/requests" },
  ],
  DEVELOPER: [
    { label: "Developer Console", path: "/developer" },
    { label: "Queue Replay", path: "/developer/queue-replay" },
    { label: "Webhook Retry", path: "/developer/webhook-retry" },
    { label: "Decision Cockpit", path: "/developer/decision-cockpit" },
    { label: "Provenance Verify", path: "/developer/provenance-verify" },
    { label: "AI Extraction History", path: "/developer/ai-extraction-history" },
    { label: "ABAC Policies", path: "/system-admin/abac" },
    { label: "Mapping Studio", path: "/system-admin/mapping-studio" },
    { label: "NLP Analytics", path: "/system-admin/nlp-analytics" },
    { label: "Regulatory Reports", path: "/system-admin/regulatory-reports" },
    { label: "Clinical Intelligence", path: "/system-admin/clinical-intelligence" },
    { label: "System Admin Dashboard", path: "/system-admin" },
    { label: "Super Admin Dashboard", path: "/super-admin" },
  ],
  SECURITY_ADMIN: [
    { label: "Security Admin", path: "/security-admin" },
    { label: "My Requests", path: "/workforce/requests" },
  ],
  SECURITY_OFFICER: [
    { label: "Security Officer", path: "/security-officer" },
    { label: "My Requests", path: "/workforce/requests" },
  ],
  RADIOLOGIST: [{ label: "My Requests", path: "/workforce/requests" }],
  THERAPIST: [{ label: "My Requests", path: "/workforce/requests" }],
  RECEPTIONIST: [{ label: "My Requests", path: "/workforce/requests" }],
  PATIENT: [
    { label: "Patient Dashboard", path: "/patient" },
    { label: "My Appointments", path: "/patient/appointments" },
    { label: "Medical Records", path: "/patient/medical-records" },
    { label: "Prescriptions", path: "/patient/prescriptions" },
    { label: "Lab Results", path: "/patient/lab-results" },
    { label: "Billing", path: "/patient/billing" },
    { label: "Insurance", path: "/patient/insurance" },
    { label: "Feedback", path: "/patient/feedback" },
  ],
  GUEST: [{ label: "Guest Home", path: "/guest" }],
};

export function getSearchCatalog(user) {
  const role = normalizeRole(user?.role || "");
  const roleItems = ROLE_ITEMS[role] || [];
  const merged = [...roleItems, ...BASE_ITEMS];

  const seen = new Set();
  return merged.filter((item) => {
    if (seen.has(item.path)) return false;
    seen.add(item.path);
    return true;
  });
}
