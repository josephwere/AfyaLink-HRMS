const prefetchedRoles = new Set();
const prefetchedGroups = new Set();

const COMMON_PREFETCHERS = [
  () => import("../pages/Profile"),
  () => import("../pages/Admin/NotificationsPage"),
  () => import("../pages/Reports/Index"),
];

const ROLE_PREFETCHERS = {
  PATIENT: [
    () => import("../pages/Patient/MyAppointments"),
    () => import("../pages/Patient/MedicalRecords"),
    () => import("../pages/Patient/FamilyRecords"),
    () => import("../pages/Patient/FamilyTimeline"),
    () => import("../pages/Patient/Billing"),
  ],
  DOCTOR: [
    () => import("../pages/Doctor/Appointments"),
    () => import("../pages/Doctor/MyPatients"),
    () => import("../pages/Doctor/OPDWorkspace"),
    () => import("../pages/Doctor/MySchedule"),
    () => import("../pages/Innovation/ClinicalOrderCopilot"),
  ],
  SURGEON: [
    () => import("../pages/Surgeon/Dashboard"),
    () => import("../pages/Innovation/ClinicalOrderCopilot"),
    () => import("../pages/Operations/TheatreOpsDashboard"),
  ],
  NURSE: [
    () => import("../pages/Nurse/MyShift"),
    () => import("../pages/Nurse/AssignedPatients"),
    () => import("../pages/Nurse/MedicationAdministration"),
  ],
  LAB_TECH: [
    () => import("../pages/LabTech/TestQueue"),
    () => import("../pages/LabTech/SampleTracking"),
    () => import("../pages/LabTech/ReportsArchive"),
  ],
  PHARMACIST: [
    () => import("../pages/Pharmacy/PrescriptionQueue"),
    () => import("../pages/Pharmacy/InventoryPage"),
    () => import("../pages/Pharmacy/ReportsPage"),
  ],
  HOSPITAL_ADMIN: [
    () => import("../pages/HospitalAdmin/Financials"),
    () => import("../pages/HospitalAdmin/Appointments"),
    () => import("../pages/HospitalAdmin/ClaimsDashboard"),
    () => import("../pages/HospitalAdmin/Customization"),
    () => import("../pages/SystemAdmin/RevenueIntelligence"),
    () => import("../pages/Innovation/ClinicalOrderCopilot"),
    () => import("../pages/Innovation/DigitalHospitalTwin"),
    () => import("../pages/Innovation/InteropMarketplace"),
  ],
  HOSPITAL_ADMIN_ASSISTANT: [
    () => import("../pages/HospitalAdmin/Appointments"),
    () => import("../pages/HospitalAdmin/Approvals"),
    () => import("../pages/HospitalAdmin/TransferCommandCenter"),
    () => import("../pages/SystemAdmin/RevenueIntelligence"),
    () => import("../pages/Innovation/ClinicalOrderCopilot"),
    () => import("../pages/Innovation/DigitalHospitalTwin"),
    () => import("../pages/Innovation/InteropMarketplace"),
  ],
  SYSTEM_ADMIN: [
    () => import("../pages/SystemAdmin/UnifiedAssistantDashboard"),
    () => import("../pages/SystemAdmin/IntegrationHub"),
    () => import("../pages/SystemAdmin/GovernmentClaimsDashboard"),
    () => import("../pages/SystemAdmin/RevenueIntelligence"),
    () => import("../pages/SystemAdmin/ComplianceCenter"),
    () => import("../pages/Innovation/ClinicalOrderCopilot"),
    () => import("../pages/Innovation/DigitalHospitalTwin"),
    () => import("../pages/Innovation/InteropMarketplace"),
    () => import("../pages/SuperAdmin/SystemSettings"),
  ],
  SUPER_ADMIN: [
    () => import("../pages/SuperAdmin/SystemSettings"),
    () => import("../pages/SuperAdmin/Hospitals"),
    () => import("../pages/SystemAdmin/UnifiedAssistantDashboard"),
    () => import("../pages/SystemAdmin/RevenueIntelligence"),
    () => import("../pages/SystemAdmin/ComplianceCenter"),
    () => import("../pages/Innovation/ClinicalOrderCopilot"),
    () => import("../pages/Innovation/DigitalHospitalTwin"),
    () => import("../pages/Innovation/InteropMarketplace"),
    () => import("../pages/Admin/SuperAssistants"),
    // Founder often role-switches; warm core page chunks opportunistically.
    () => import("../pages/HospitalAdmin/Dashboard"),
    () => import("../pages/Doctor/Dashboard"),
    () => import("../pages/Patient/Dashboard"),
    () => import("../pages/CommunityHealthWorker/Dashboard"),
    () => import("../pages/LabTech/Dashboard"),
    () => import("../pages/Staff/Dashboard"),
    () => import("../pages/Receptionist/Dashboard"),
  ],
  DEVELOPER: [
    () => import("../pages/Developer/Dashboard"),
    () => import("../pages/Developer/DecisionCockpit"),
    () => import("../pages/SystemAdmin/IntegrationControlPlane"),
    () => import("../pages/HospitalAdmin/Dashboard"),
    () => import("../pages/Doctor/Dashboard"),
    () => import("../pages/Patient/Dashboard"),
    () => import("../pages/CommunityHealthWorker/Dashboard"),
  ],
  RECEPTIONIST: [
    () => import("../pages/Receptionist/BookingDesk"),
    () => import("../pages/Communication/Center"),
  ],
  HR_MANAGER: [
    () => import("../pages/Admin/TrainingTracker"),
    () => import("../pages/Workforce/MyRequests"),
  ],
  PAYROLL_OFFICER: [
    () => import("../pages/Payments/PaymentsPage"),
    () => import("../pages/Workforce/MyRequests"),
  ],
  SUPER_ASSISTANT: [
    () => import("../pages/SystemAdmin/UnifiedAssistantDashboard"),
    () => import("../pages/Communication/Center"),
  ],
};

function shouldDeferPrefetch() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!connection) return false;
  if (connection.saveData) return true;
  return ["slow-2g", "2g"].includes(connection.effectiveType);
}

function schedule(task) {
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(task, { timeout: 2500 });
    return;
  }
  window.setTimeout(task, 1200);
}

export function prefetchRoutesForRole(role) {
  const normalizedRole = String(role || "").toUpperCase();
  if (!normalizedRole || prefetchedRoles.has(normalizedRole) || shouldDeferPrefetch()) return;
  prefetchedRoles.add(normalizedRole);

  const tasks = [...COMMON_PREFETCHERS, ...(ROLE_PREFETCHERS[normalizedRole] || [])];
  if (!tasks.length) return;

  schedule(() => {
    tasks.forEach((load) => {
      Promise.resolve()
        .then(() => load())
        .catch(() => {});
    });
  });
}

function normalizePrefetchPath(input) {
  if (!input) return "";
  const raw = String(input);
  try {
    const url = new URL(raw, window.location.origin);
    return url.pathname || "/";
  } catch {
    return raw.startsWith("/") ? raw.split("?")[0] : `/${raw}`.split("?")[0];
  }
}

function groupForPath(pathname) {
  const path = normalizePrefetchPath(pathname);
  if (!path || path === "/") return "";
  if (path.startsWith("/doctor")) return "doctor";
  if (path.startsWith("/patient")) return "patient";
  if (path.startsWith("/hospital-admin")) return "hospital-admin";
  if (path.startsWith("/super-admin")) return "super-admin";
  if (path.startsWith("/system-admin")) return "system-admin";
  if (path.startsWith("/community-health-worker") || path.startsWith("/nurse")) return "care-lite";
  if (path.startsWith("/lab-tech") || path.startsWith("/pharmacy") || path.startsWith("/security")) return "clinical-lite";
  if (path.startsWith("/receptionist") || path.startsWith("/hr-manager") || path.startsWith("/payroll-officer")) return "admin-lite";
  if (path.startsWith("/reports") || path.startsWith("/analytics") || path.startsWith("/inventory") || path.startsWith("/communication")) return "ops-lite";
  if (path.startsWith("/payments") || path.startsWith("/workforce")) return "workflow-lite";
  if (path.startsWith("/ai")) return "ai";
  if (path.startsWith("/profile")) return "profile";
  if (path.startsWith("/notifications")) return "notifications";
  if (path.startsWith("/admin")) return "admin";
  if (path.startsWith("/staff") || path.startsWith("/therapist") || path.startsWith("/radiologist") || path.startsWith("/surgeon")) return "staff-lite";
  return "";
}

const GROUP_PREFETCHERS = {
  doctor: () => import("../pages/Doctor/Dashboard"),
  patient: () => import("../pages/Patient/Dashboard"),
  "hospital-admin": () => import("../pages/HospitalAdmin/Dashboard"),
  "super-admin": () => import("../pages/SuperAdmin/Dashboard"),
  "system-admin": () => import("../pages/SystemAdmin/Dashboard"),
  "care-lite": () => import("../pages/CommunityHealthWorker/Dashboard"),
  "clinical-lite": () => import("../pages/LabTech/Dashboard"),
  "admin-lite": () => import("../pages/Receptionist/Dashboard"),
  "ops-lite": () => import("../pages/Reports/Index"),
  "workflow-lite": () => import("../pages/Payments/PaymentsPage"),
  "staff-lite": () => import("../pages/Staff/Dashboard"),
  ai: () => import("../pages/AI/MedicalAssistant"),
  profile: () => import("../pages/Profile"),
  notifications: () => import("../pages/Admin/NotificationsPage"),
  admin: () => import("../pages/Admin/Dashboard"),
};

export function prefetchRouteByPath(path) {
  if (!path || shouldDeferPrefetch()) return;
  const group = groupForPath(path);
  if (!group) return;
  if (prefetchedGroups.has(group)) return;
  const loader = GROUP_PREFETCHERS[group];
  if (typeof loader !== "function") return;
  prefetchedGroups.add(group);

  schedule(() => {
    Promise.resolve()
      .then(() => loader())
      .catch(() => {});
  });
}
