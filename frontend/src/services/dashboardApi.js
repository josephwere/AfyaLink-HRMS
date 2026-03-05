import { apiFetch } from "../utils/apiFetch";

export const getDoctorDashboard = () => apiFetch("/api/dashboard/doctor");
export const getNurseDashboard = () => apiFetch("/api/dashboard/nurse");
export const getHRDashboard = () => apiFetch("/api/dashboard/hr");
export const getPayrollDashboard = () => apiFetch("/api/dashboard/payroll");
export const getStaffDashboard = () => apiFetch("/api/dashboard/staff");
export const getRadiologistDashboard = () => apiFetch("/api/dashboard/radiologist");
export const getTherapistDashboard = () => apiFetch("/api/dashboard/therapist");
export const getReceptionistDashboard = () => apiFetch("/api/dashboard/receptionist");
export const getSurgeonDashboard = () => apiFetch("/api/dashboard/surgeon");
export const getTriageOpsDashboard = () => apiFetch("/api/dashboard/ops/triage");
export const getIcuOpsDashboard = () => apiFetch("/api/dashboard/ops/icu");
export const getTheatreOpsDashboard = () => apiFetch("/api/dashboard/ops/theatre");
export const getImagingOpsDashboard = () => apiFetch("/api/dashboard/ops/imaging");
export const getEmergencyCommandDashboard = () => apiFetch("/api/dashboard/ops/emergency-command");
export const getNeonatalIcuDashboard = () => apiFetch("/api/dashboard/ops/neonatal-icu");
export const getDialysisOpsDashboard = () => apiFetch("/api/dashboard/ops/dialysis");
export const getOncologyDaycareDashboard = () => apiFetch("/api/dashboard/ops/oncology-daycare");
export const getLabTechDashboard = () => apiFetch("/api/dashboard/lab-tech");
export const getSecurityAdminDashboard = () => apiFetch("/api/dashboard/security-admin");
export const getSecurityOfficerDashboard = () => apiFetch("/api/dashboard/security-officer");
export const getHospitalAdminDashboard = () => apiFetch("/api/dashboard/hospital-admin");
export const getPatientDashboard = () => apiFetch("/api/dashboard/patient");
export const getSuperAdminDashboard = () => apiFetch("/api/dashboard/super-admin");
export const getDashboardActionMatrix = () => apiFetch("/api/dashboard/action-matrix");
export const exportDashboardActionMatrixCsv = () =>
  apiFetch("/api/dashboard/action-matrix/export.csv");
