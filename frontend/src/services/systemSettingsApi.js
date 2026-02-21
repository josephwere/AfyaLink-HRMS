import api from "./api";

export const getSystemSettings = async () => {
  const res = await api.get("/api/system-settings");
  return res.data;
};

export const updateSystemSettings = async (data) => {
  const res = await api.put("/api/system-settings", data);
  return res.data;
};
