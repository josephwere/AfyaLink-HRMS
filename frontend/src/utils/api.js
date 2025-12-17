import axios from 'axios';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true, // important for cookies / refresh tokens
  timeout: 20000,
});

// Attach JWT token if present
API.interceptors.request.use(
  (cfg) => {
    const token = localStorage.getItem('token');
    if (token) {
      cfg.headers.Authorization = `Bearer ${token}`;
    }
    return cfg;
  },
  (error) => Promise.reject(error)
);

// ===================== AUTH =====================
export const login = (data) => API.post('/auth/login', data);
export const register = (data) => API.post('/auth/register', data);
export const logout = () => API.post('/auth/logout');
export const getProfile = () => API.get('/auth/me');

// ===================== USERS =====================
export const getUsers = () => API.get('/users');
export const getUserById = (id) => API.get(`/users/${id}`);
export const updateUser = (id, data) => API.put(`/users/${id}`, data);
export const deleteUser = (id) => API.delete(`/users/${id}`);

// ===================== HOSPITALS =====================
export const getHospitals = () => API.get('/hospitals');
export const getHospitalById = (id) => API.get(`/hospitals/${id}`);
export const createHospital = (data) => API.post('/hospitals', data);
export const updateHospital = (id, data) => API.put(`/hospitals/${id}`, data);

// ===================== PATIENTS =====================
export const getPatients = () => API.get('/patients');
export const getPatientById = (id) => API.get(`/patients/${id}`);
export const createPatient = (data) => API.post('/patients', data);
export const updatePatient = (id, data) => API.put(`/patients/${id}`, data);

// ===================== APPOINTMENTS =====================
export const getAppointments = () => API.get('/appointments');
export const createAppointment = (data) => API.post('/appointments', data);
export const updateAppointment = (id, data) =>
  API.put(`/appointments/${id}`, data);
export const deleteAppointment = (id) =>
  API.delete(`/appointments/${id}`);

// ===================== LABS =====================
export const getLabTests = () => API.get('/labs');
export const createLabTest = (data) => API.post('/labs', data);
export const updateLabTest = (id, data) =>
  API.put(`/labs/${id}`, data);

// ===================== FINANCIALS =====================
export const getFinancials = () => API.get('/financials');
export const createFinancial = (data) =>
  API.post('/financials', data);
export const updateFinancial = (id, data) =>
  API.put(`/financials/${id}`, data);

// ===================== TRANSFERS =====================
export const getTransfers = () => API.get('/transfers');
export const createTransfer = (data) =>
  API.post('/transfers', data);

// ===================== NOTIFICATIONS =====================
export const getNotifications = () => API.get('/notifications');

// ===================== AI / ML =====================
export const runAI = (data) => API.post('/ai', data);
export const runML = (data) => API.post('/ml', data);

export default API;
