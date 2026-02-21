// frontend/src/utils/api.js
import { apiFetch } from "./apiFetch";

const withApiPrefix = (path) => {
  if (path.startsWith("/api/")) return path;
  return `/api${path.startsWith("/") ? "" : "/"}${path}`;
};

const request = async (method, path, body) => {
  const data = await apiFetch(withApiPrefix(path), {
    method,
    body,
  });
  return { data };
};

// ===================== AUTH =====================
export const login = (data) => request("POST", "/auth/login", data);
export const register = (data) => request("POST", "/auth/register", data);
export const logout = async () => {
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
  return { ok: true };
};
export const getProfile = () => request("GET", "/auth/me");

// ===================== USERS =====================
export const getUsers = () => request("GET", "/users");
export const getUserById = (id) => request("GET", `/users/${id}`);
export const updateUser = (id, data) => request("PUT", `/users/${id}`, data);
export const deleteUser = (id) => request("DELETE", `/users/${id}`);

// ===================== HOSPITALS =====================
export const getHospitals = () => request("GET", "/hospitals");
export const getHospitalById = (id) => request("GET", `/hospitals/${id}`);
export const createHospital = (data) => request("POST", "/hospitals", data);
export const updateHospital = (id, data) => request("PUT", `/hospitals/${id}`, data);

// ===================== PATIENTS =====================
export const getPatients = () => request("GET", "/patients");
export const getPatientById = (id) => request("GET", `/patients/${id}`);
export const createPatient = (data) => request("POST", "/patients", data);
export const updatePatient = (id, data) => request("PUT", `/patients/${id}`, data);

// ===================== APPOINTMENTS =====================
export const getAppointments = () => request("GET", "/appointments");
export const createAppointment = (data) => request("POST", "/appointments", data);
export const updateAppointment = (id, data) => request("PUT", `/appointments/${id}`, data);
export const deleteAppointment = (id) => request("DELETE", `/appointments/${id}`);

// ===================== LABS =====================
export const getLabTests = () => request("GET", "/labs");
export const createLabTest = (data) => request("POST", "/labs", data);
export const updateLabTest = (id, data) => request("PUT", `/labs/${id}`, data);

// ===================== FINANCIALS =====================
export const getFinancials = () => request("GET", "/financials");
export const createFinancial = (data) => request("POST", "/financials", data);
export const updateFinancial = (id, data) => request("PUT", `/financials/${id}`, data);

// ===================== TRANSFERS =====================
export const getTransfers = () => request("GET", "/transfers");
export const createTransfer = (data) => request("POST", "/transfers", data);

// ===================== NOTIFICATIONS =====================
export const getNotifications = () => request("GET", "/notifications");

// ===================== AI / ML =====================
export const runAI = (data) => request("POST", "/ai", data);
export const runML = (data) => request("POST", "/ml", data);

export const patch = (path, data) => request("PATCH", path, data);

// default export for backward compatibility
export default {
  login,
  register,
  logout,
  getProfile,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  getHospitals,
  getHospitalById,
  createHospital,
  updateHospital,
  getPatients,
  getPatientById,
  createPatient,
  updatePatient,
  getAppointments,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  getLabTests,
  createLabTest,
  updateLabTest,
  getFinancials,
  createFinancial,
  updateFinancial,
  getTransfers,
  createTransfer,
  getNotifications,
  runAI,
  runML,
  patch,
};
