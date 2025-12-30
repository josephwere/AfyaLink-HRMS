import api from "./api"; // your axios instance

export const fetchMenu = async () => {
  const res = await api.get("/menu");
  return res.data;
};
