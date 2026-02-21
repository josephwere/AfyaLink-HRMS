import api from "./api";

export const createHospital = async (data) => {
  const res = await api.post("/api/hospitals", data);
  return res.data;
};

export const updateHospital = async (id, data) => {
  const res = await api.put(`/api/hospitals/${id}`, data);
  return res.data;
};
