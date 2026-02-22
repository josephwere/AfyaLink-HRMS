import apiFetch from "../utils/apiFetch";

export const createHospital = async (data) => {
  return apiFetch("/api/hospitals", {
    method: "POST",
    body: data,
  });
};

export const updateHospital = async (id, data) => {
  return apiFetch(`/api/hospitals/${id}`, {
    method: "PUT",
    body: data,
  });
};
