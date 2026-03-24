const prefetchedRoles = new Set();

const COMMON_PREFETCHERS = [
  () => import("../pages/Profile"),
  () => import("../pages/Admin/NotificationsPage"),
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
  ],
  DEVELOPER: [
    () => import("../pages/Developer/Dashboard"),
    () => import("../pages/Developer/DecisionCockpit"),
    () => import("../pages/SystemAdmin/IntegrationControlPlane"),
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
