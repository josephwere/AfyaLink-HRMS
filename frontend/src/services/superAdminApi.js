import api from "./api";

export const listHospitals = async (params = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v) !== "") {
      qs.set(k, String(v));
    }
  });
  const query = qs.toString() ? `?${qs.toString()}` : "";
  const res = await api.get(`/api/super-admin/hospitals${query}`);
  return res.data;
};

export const registerHospitalAdmin = async (data) => {
  const res = await api.post("/api/super-admin/register-hospital-admin", data);
  return res.data;
};

export const registerSystemAdmin = async (data) => {
  const res = await api.post("/api/super-admin/register-system-admin", data);
  return res.data;
};

export const registerDeveloper = async (data) => {
  const res = await api.post("/api/super-admin/register-developer", data);
  return res.data;
};

export const listHospitalAdmins = async (params = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v) !== "") {
      qs.set(k, String(v));
    }
  });
  const query = qs.toString() ? `?${qs.toString()}` : "";
  const res = await api.get(`/api/super-admin/hospital-admins${query}`);
  return res.data;
};

export const updateHospitalAdmin = async (id, data) => {
  const res = await api.patch(`/api/super-admin/hospital-admins/${id}`, data);
  return res.data;
};
