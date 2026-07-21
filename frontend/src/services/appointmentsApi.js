import { apiFetch } from "../utils/apiFetch";

export const listAppointments = async () => apiFetch("/api/appointments");
export const listPatients = async (params = {}) => {
  const query = new URLSearchParams();
  if (params.cursorMode) query.set("cursorMode", String(params.cursorMode));
  if (params.limit) query.set("limit", String(params.limit));
  if (params.cursor) query.set("cursor", params.cursor);
  return apiFetch(`/api/patients${query.toString() ? `?${query.toString()}` : ""}`);
};
export const listDoctors = async () => apiFetch("/api/users");
export const createAppointment = async (payload) =>
  apiFetch("/api/appointments", {
    method: "POST",
    body: payload,
  });
export const cancelAppointment = async (id) =>
  apiFetch(`/api/appointments/${id}`, {
    method: "DELETE",
  });
