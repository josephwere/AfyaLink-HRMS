const prefetchedRoles = new Set();
const prefetchedGroups = new Set();

const pageModules = import.meta.glob("../pages/**/*.jsx");

function loadPage(relPath) {
  const fullPath = `../pages/${relPath}.jsx`;
  const loader = pageModules[fullPath];
  if (typeof loader === "function") {
    return loader();
  }
  return Promise.resolve(null);
}

const COMMON_PREFETCH_KEYS = [
  "Profile",
  "Admin/NotificationsPage",
  "Reports/Index",
];

const ROLE_PREFETCH_KEYS = {
  PATIENT: [
    "Patient/MyAppointments",
    "Patient/MedicalRecords",
    "Patient/FamilyRecords",
    "Patient/FamilyTimeline",
    "Patient/Billing",
  ],
  DOCTOR: [
    "Doctor/Appointments",
    "Doctor/MyPatients",
    "Doctor/OPDWorkspace",
    "Doctor/MySchedule",
    "Innovation/ClinicalOrderCopilot",
  ],
  SURGEON: [
    "Surgeon/Dashboard",
    "Innovation/ClinicalOrderCopilot",
    "Operations/TheatreOpsDashboard",
  ],
  NURSE: [
    "Nurse/MyShift",
    "Nurse/AssignedPatients",
    "Nurse/MedicationAdministration",
  ],
  LAB_TECH: [
    "LabTech/TestQueue",
    "LabTech/SampleTracking",
    "LabTech/ReportsArchive",
  ],
  PHARMACIST: [
    "Pharmacy/PrescriptionQueue",
    "Pharmacy/InventoryPage",
    "Pharmacy/ReportsPage",
  ],
  HOSPITAL_ADMIN: [
    "HospitalAdmin/Financials",
    "HospitalAdmin/Appointments",
    "HospitalAdmin/ClaimsDashboard",
    "HospitalAdmin/Customization",
    "SystemAdmin/RevenueIntelligence",
    "Innovation/ClinicalOrderCopilot",
    "Innovation/DigitalHospitalTwin",
    "Innovation/InteropMarketplace",
  ],
  HOSPITAL_ADMIN_ASSISTANT: [
    "HospitalAdmin/Appointments",
    "HospitalAdmin/Approvals",
    "HospitalAdmin/TransferCommandCenter",
    "SystemAdmin/RevenueIntelligence",
    "Innovation/ClinicalOrderCopilot",
    "Innovation/DigitalHospitalTwin",
    "Innovation/InteropMarketplace",
  ],
  SYSTEM_ADMIN: [
    "SystemAdmin/UnifiedAssistantDashboard",
    "SystemAdmin/IntegrationHub",
    "SystemAdmin/GovernmentClaimsDashboard",
    "SystemAdmin/RevenueIntelligence",
    "SystemAdmin/ComplianceCenter",
    "Innovation/ClinicalOrderCopilot",
    "Innovation/DigitalHospitalTwin",
    "Innovation/InteropMarketplace",
    "SuperAdmin/SystemSettings",
  ],
  SUPER_ADMIN: [
    "SuperAdmin/SystemSettings",
    "SuperAdmin/Hospitals",
    "SystemAdmin/UnifiedAssistantDashboard",
    "SystemAdmin/RevenueIntelligence",
    "SystemAdmin/ComplianceCenter",
    "Innovation/ClinicalOrderCopilot",
    "Innovation/DigitalHospitalTwin",
    "Innovation/InteropMarketplace",
    "Admin/SuperAssistants",
    "HospitalAdmin/Dashboard",
    "Doctor/Dashboard",
    "Patient/Dashboard",
    "CommunityHealthWorker/Dashboard",
    "LabTech/Dashboard",
    "Staff/Dashboard",
    "Receptionist/Dashboard",
  ],
  DEVELOPER: [
    "Developer/Dashboard",
    "Developer/DecisionCockpit",
    "SystemAdmin/IntegrationControlPlane",
    "HospitalAdmin/Dashboard",
    "Doctor/Dashboard",
    "Patient/Dashboard",
    "CommunityHealthWorker/Dashboard",
  ],
  RECEPTIONIST: [
    "Receptionist/BookingDesk",
    "Communication/Center",
  ],
  HR_MANAGER: [
    "Admin/TrainingTracker",
    "Workforce/MyRequests",
  ],
  PAYROLL_OFFICER: [
    "Payments/PaymentsPage",
    "Workforce/MyRequests",
  ],
  SUPER_ASSISTANT: [
    "SystemAdmin/UnifiedAssistantDashboard",
    "Communication/Center",
  ],
};

function shouldDeferPrefetch() {
  if (typeof navigator === "undefined") return true;
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!connection) return false;
  if (connection.saveData) return true;
  return ["slow-2g", "2g"].includes(connection.effectiveType);
}

function schedule(task) {
  if (typeof window === "undefined") return;
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

  const keys = [...COMMON_PREFETCH_KEYS, ...(ROLE_PREFETCH_KEYS[normalizedRole] || [])];
  if (!keys.length) return;

  schedule(() => {
    keys.forEach((key) => {
      Promise.resolve()
        .then(() => loadPage(key))
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

const GROUP_PREFETCH_KEYS = {
  doctor: "Doctor/Dashboard",
  patient: "Patient/Dashboard",
  "hospital-admin": "HospitalAdmin/Dashboard",
  "super-admin": "SuperAdmin/Dashboard",
  "system-admin": "SystemAdmin/Dashboard",
  "care-lite": "CommunityHealthWorker/Dashboard",
  "clinical-lite": "LabTech/Dashboard",
  "admin-lite": "Receptionist/Dashboard",
  "ops-lite": "Reports/Index",
  "workflow-lite": "Payments/PaymentsPage",
  "staff-lite": "Staff/Dashboard",
  ai: "AI/MedicalAssistant",
  profile: "Profile",
  notifications: "Admin/NotificationsPage",
  admin: "Admin/Dashboard",
};

export function prefetchRouteByPath(path) {
  if (!path || shouldDeferPrefetch()) return;
  const group = groupForPath(path);
  if (!group) return;
  if (prefetchedGroups.has(group)) return;
  const key = GROUP_PREFETCH_KEYS[group];
  if (!key) return;
  prefetchedGroups.add(group);

  schedule(() => {
    Promise.resolve()
      .then(() => loadPage(key))
      .catch(() => {});
  });
}
