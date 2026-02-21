import api from "./api";

export const createHospital = async (data) => {
  const res = await api.post("/api/hospitals", data);
  return res.data;
};
