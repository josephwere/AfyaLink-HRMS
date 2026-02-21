import api from "./api"; // your axios instance

export const fetchMenu = async () => {
  const res = await api.get("/api/menu");
  return res.data;
};
