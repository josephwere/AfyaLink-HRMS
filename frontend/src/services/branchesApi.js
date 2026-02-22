import apiFetch from "../utils/apiFetch";

export const listBranches = async (hospitalId) => {
  const query = hospitalId ? `?hospitalId=${encodeURIComponent(hospitalId)}` : "";
  return apiFetch(`/api/branches/list${query}`);
};

export const createBranch = async (data) => {
  return apiFetch("/api/branches", {
    method: "POST",
    body: data,
  });
};

export const updateBranch = async (id, data) => {
  return apiFetch(`/api/branches/${id}`, {
    method: "PUT",
    body: data,
  });
};

export const removeBranch = async (id) => {
  return apiFetch(`/api/branches/${id}`, {
    method: "DELETE",
  });
};
