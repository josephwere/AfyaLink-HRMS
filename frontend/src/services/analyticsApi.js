import { apiFetch } from "../utils/apiFetch";

export const getRevenueDaily = () => apiFetch("/api/analytics/revenue/daily");
export const getDoctorUtilization = () => apiFetch("/api/analytics/doctors/utilization");
export const getPharmacyProfit = () => apiFetch("/api/analytics/pharmacy/profit");
export const getAppointmentOverview = () => apiFetch("/api/analytics/appointments/overview");
export const getAppointmentHeatmap = () => apiFetch("/api/analytics/appointments/heatmap");
export const getConsultationActivity = () => apiFetch("/api/analytics/consultations/activity");
