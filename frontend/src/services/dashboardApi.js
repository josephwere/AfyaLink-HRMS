import { apiFetch } from "../utils/apiFetch";
import { guardedConsoleFetch } from "./guardedConsoleFetch";

async function loadDashboardSnapshot(path, warmupKey) {
  const result = await guardedConsoleFetch(path, { warmupKey });
  return result?.payload || null;
}

export const getDoctorDashboard = () => loadDashboardSnapshot("/api/dashboard/doctor", "dashboard-doctor");
export const getNurseDashboard = () => loadDashboardSnapshot("/api/dashboard/nurse", "dashboard-nurse");
export const getHRDashboard = () => loadDashboardSnapshot("/api/dashboard/hr", "dashboard-hr");
export const getPayrollDashboard = () => loadDashboardSnapshot("/api/dashboard/payroll", "dashboard-payroll");
export const getStaffDashboard = () => loadDashboardSnapshot("/api/dashboard/staff", "dashboard-staff");
export const getRadiologistDashboard = () => loadDashboardSnapshot("/api/dashboard/radiologist", "dashboard-radiologist");
export const getTherapistDashboard = () => loadDashboardSnapshot("/api/dashboard/therapist", "dashboard-therapist");
export const getReceptionistDashboard = () => loadDashboardSnapshot("/api/dashboard/receptionist", "dashboard-receptionist");
export const getSurgeonDashboard = () => loadDashboardSnapshot("/api/dashboard/surgeon", "dashboard-surgeon");
export const getTriageOpsDashboard = () => loadDashboardSnapshot("/api/dashboard/ops/triage", "dashboard-ops-triage");
export const getIcuOpsDashboard = () => loadDashboardSnapshot("/api/dashboard/ops/icu", "dashboard-ops-icu");
export const getTheatreOpsDashboard = () => loadDashboardSnapshot("/api/dashboard/ops/theatre", "dashboard-ops-theatre");
export const getImagingOpsDashboard = () => loadDashboardSnapshot("/api/dashboard/ops/imaging", "dashboard-ops-imaging");
export const getEmergencyCommandDashboard = () => loadDashboardSnapshot("/api/dashboard/ops/emergency-command", "dashboard-ops-emergency");
export const getNeonatalIcuDashboard = () => loadDashboardSnapshot("/api/dashboard/ops/neonatal-icu", "dashboard-ops-neonatal");
export const getDialysisOpsDashboard = () => loadDashboardSnapshot("/api/dashboard/ops/dialysis", "dashboard-ops-dialysis");
export const getOncologyDaycareDashboard = () => loadDashboardSnapshot("/api/dashboard/ops/oncology-daycare", "dashboard-ops-oncology");
export const getLabTechDashboard = () => loadDashboardSnapshot("/api/dashboard/lab-tech", "dashboard-lab-tech");
export const getSecurityAdminDashboard = () => loadDashboardSnapshot("/api/dashboard/security-admin", "dashboard-security-admin");
export const getSecurityOfficerDashboard = () => loadDashboardSnapshot("/api/dashboard/security-officer", "dashboard-security-officer");
export const getHospitalAdminDashboard = () => loadDashboardSnapshot("/api/dashboard/hospital-admin", "dashboard-hospital-admin");
export const getExecutiveDashboard = () => loadDashboardSnapshot("/api/dashboard/executive", "dashboard-executive");
export const getPatientDashboard = () => loadDashboardSnapshot("/api/dashboard/patient", "dashboard-patient");
export const getSuperAdminDashboard = () => loadDashboardSnapshot("/api/dashboard/super-admin", "dashboard-super-admin");
export const listDoctorDashboardAppointments = async () => {
  const result = await guardedConsoleFetch("/api/appointments?limit=8&cursorMode=1", {
    warmupKey: "doctor-dashboard-appointments",
  });
  return result?.payload || [];
};

export const listDoctorDashboardNotifications = async () => {
  const result = await guardedConsoleFetch("/api/notifications?limit=8", {
    warmupKey: "doctor-dashboard-notifications",
  });
  const payload = result?.payload || result;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload)) return payload;
  return [];
};

export const getDashboardActionMatrix = () => apiFetch("/api/dashboard/action-matrix");
export const exportDashboardActionMatrixCsv = () =>
  apiFetch("/api/dashboard/action-matrix/export.csv");
