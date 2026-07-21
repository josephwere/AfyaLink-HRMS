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

export const listHospitalMarketplace = async (params = {}) => {
  const query = new URLSearchParams();
  if (params.q) query.set("q", String(params.q));
  if (params.limit) query.set("limit", String(params.limit));
  if (params.lat) query.set("lat", String(params.lat));
  if (params.lng) query.set("lng", String(params.lng));
  if (params.radiusKm) query.set("radiusKm", String(params.radiusKm));
  const qs = query.toString();
  return apiFetch(`/api/hospitals/marketplace${qs ? `?${qs}` : ""}`);
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
