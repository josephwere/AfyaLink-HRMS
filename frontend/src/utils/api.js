// frontend/src/utils/api.js
import { apiFetch } from './apiFetch';

// ===================== AUTH =====================
export const login = (data) =>
  apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(data) }).then(res => res.json());
export const register = (data) =>
  apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(data) }).then(res => res.json());
export const logout = () =>
  apiFetch('/auth/logout', { method: 'POST' }).then(res => res.json());
export const getProfile = () =>
  apiFetch('/auth/me').then(res => res.json());

// ===================== USERS =====================
export const getUsers = () => apiFetch('/users').then(res => res.json());
export const getUserById = (id) => apiFetch(`/users/${id}`).then(res => res.json());
export const updateUser = (id, data) =>
  apiFetch(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }).then(res => res.json());
export const deleteUser = (id) =>
  apiFetch(`/users/${id}`, { method: 'DELETE' }).then(res => res.json());

// ===================== HOSPITALS =====================
export const getHospitals = () => apiFetch('/hospitals').then(res => res.json());
export const getHospitalById = (id) => apiFetch(`/hospitals/${id}`).then(res => res.json());
export const createHospital = (data) =>
  apiFetch('/hospitals', { method: 'POST', body: JSON.stringify(data) }).then(res => res.json());
export const updateHospital = (id, data) =>
  apiFetch(`/hospitals/${id}`, { method: 'PUT', body: JSON.stringify(data) }).then(res => res.json());

// ===================== PATIENTS =====================
export const getPatients = () => apiFetch('/patients').then(res => res.json());
export const getPatientById = (id) => apiFetch(`/patients/${id}`).then(res => res.json());
export const createPatient = (data) =>
  apiFetch('/patients', { method: 'POST', body: JSON.stringify(data) }).then(res => res.json());
export const updatePatient = (id, data) =>
  apiFetch(`/patients/${id}`, { method: 'PUT', body: JSON.stringify(data) }).then(res => res.json());

// ===================== APPOINTMENTS =====================
export const getAppointments = () => apiFetch('/appointments').then(res => res.json());
export const createAppointment = (data) =>
  apiFetch('/appointments', { method: 'POST', body: JSON.stringify(data) }).then(res => res.json());
export const updateAppointment = (id, data) =>
  apiFetch(`/appointments/${id}`, { method: 'PUT', body: JSON.stringify(data) }).then(res => res.json());
export const deleteAppointment = (id) =>
  apiFetch(`/appointments/${id}`, { method: 'DELETE' }).then(res => res.json());

// ===================== LABS =====================
export const getLabTests = () => apiFetch('/labs').then(res => res.json());
export const createLabTest = (data) =>
  apiFetch('/labs', { method: 'POST', body: JSON.stringify(data) }).then(res => res.json());
export const updateLabTest = (id, data) =>
  apiFetch(`/labs/${id}`, { method: 'PUT', body: JSON.stringify(data) }).then(res => res.json());

// ===================== FINANCIALS =====================
export const getFinancials = () => apiFetch('/financials').then(res => res.json());
export const createFinancial = (data) =>
  apiFetch('/financials', { method: 'POST', body: JSON.stringify(data) }).then(res => res.json());
export const updateFinancial = (id, data) =>
  apiFetch(`/financials/${id}`, { method: 'PUT', body: JSON.stringify(data) }).then(res => res.json());

// ===================== TRANSFERS =====================
export const getTransfers = () => apiFetch('/transfers').then(res => res.json());
export const createTransfer = (data) =>
  apiFetch('/transfers', { method: 'POST', body: JSON.stringify(data) }).then(res => res.json());

// ===================== NOTIFICATIONS =====================
export const getNotifications = () => apiFetch('/notifications').then(res => res.json());

// ===================== AI / ML =====================
export const runAI = (data) =>
  apiFetch('/ai', { method: 'POST', body: JSON.stringify(data) }).then(res => res.json());
export const runML = (data) =>
  apiFetch('/ml', { method: 'POST', body: JSON.stringify(data) }).then(res => res.json());

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
};
