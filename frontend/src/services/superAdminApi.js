import api from "./api";

export const listHospitals = async () => {
  const res = await api.get("/api/super-admin/hospitals");
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
