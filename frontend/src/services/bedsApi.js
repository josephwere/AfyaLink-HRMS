import apiFetch from "../utils/apiFetch";

export const listBeds = async ({ hospitalId } = {}) => {
  const query = hospitalId ? `?hospitalId=${encodeURIComponent(hospitalId)}` : "";
  return apiFetch(`/api/beds${query}`);
};

export const getBedTimeline = async ({ bedId, hospitalId } = {}) => {
  const query = hospitalId ? `?hospitalId=${encodeURIComponent(hospitalId)}` : "";
  return apiFetch(`/api/beds/${bedId}/timeline${query}`);
};

export const updateBed = async (bedId, payload) => apiFetch(`/api/beds/${bedId}`, { method: "PUT", body: payload });

export const transferBed = async (bedId, payload) => apiFetch(`/api/beds/${bedId}/transfer`, { method: "POST", body: payload });

export const dischargeBed = async (bedId, payload) => apiFetch(`/api/beds/${bedId}/discharge`, { method: "POST", body: payload });

export const createBed = async (payload) => apiFetch(`/api/beds`, { method: "POST", body: payload });

export const searchPatients = async ({ q, hospitalId } = {}) => {
  const qs = new URLSearchParams({ q: String(q || "") });
  if (hospitalId) qs.set("hospitalId", String(hospitalId));
  return apiFetch(`/api/patients/search?${qs.toString()}`);
};

export default {
  listBeds,
  getBedTimeline,
  updateBed,
  transferBed,
  dischargeBed,
  createBed,
  searchPatients,
};
