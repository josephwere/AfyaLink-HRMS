import api from "./api";

export const listBranches = async (hospitalId) => {
  const query = hospitalId ? `?hospitalId=${encodeURIComponent(hospitalId)}` : "";
  const res = await api.get(`/api/branches/list${query}`);
  return res.data;
};

export const createBranch = async (data) => {
  const res = await api.post("/api/branches", data);
  return res.data;
};

export const updateBranch = async (id, data) => {
  const res = await api.put(`/api/branches/${id}`, data);
  return res.data;
};

export const removeBranch = async (id) => {
  const res = await api.delete(`/api/branches/${id}`);
  return res.data;
};
