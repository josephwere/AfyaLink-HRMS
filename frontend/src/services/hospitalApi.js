import apiFetch from "../utils/apiFetch";

export const createHospital = async (data) => {
  if (data instanceof FormData) {
    return apiFetch("/api/hospitals", {
      method: "POST",
      body: data,
    });
  }
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

export const searchGovernmentHospitals = async (params = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v) !== "") {
      qs.set(k, String(v));
    }
  });
  const query = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch(`/api/hospitals/registry/search${query}`);
};
