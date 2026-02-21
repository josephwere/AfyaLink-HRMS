import { apiFetch } from "../utils/apiFetch";

export const getDoctorDashboard = () => apiFetch("/api/dashboard/doctor");
export const getNurseDashboard = () => apiFetch("/api/dashboard/nurse");
export const getHRDashboard = () => apiFetch("/api/dashboard/hr");
export const getPayrollDashboard = () => apiFetch("/api/dashboard/payroll");
export const getStaffDashboard = () => apiFetch("/api/dashboard/staff");
export const getLabTechDashboard = () => apiFetch("/api/dashboard/lab-tech");
export const getSecurityAdminDashboard = () => apiFetch("/api/dashboard/security-admin");
export const getSecurityOfficerDashboard = () => apiFetch("/api/dashboard/security-officer");
export const getHospitalAdminDashboard = () => apiFetch("/api/dashboard/hospital-admin");
export const getPatientDashboard = () => apiFetch("/api/dashboard/patient");
export const getSuperAdminDashboard = () => apiFetch("/api/dashboard/super-admin");
