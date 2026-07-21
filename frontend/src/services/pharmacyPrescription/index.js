import { apiFetch } from "../../utils/apiFetch";

export async function listPrescriptions({ appointmentId, limit = 100 } = {}) {
  const qs = new URLSearchParams();
  if (appointmentId) qs.set("appointmentId", String(appointmentId));
  if (limit) qs.set("limit", String(limit));
  return apiFetch(`/api/pharmacy/prescriptions${qs.toString() ? `?${qs.toString()}` : ""}`);
}

export async function createPrescription(payload) {
  return apiFetch("/api/pharmacy/prescriptions", {
    method: "POST",
    body: payload,
  });
}

export async function updatePrescription(id, payload) {
  return apiFetch(`/api/pharmacy/prescriptions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: payload,
  });
}

export default {
  listPrescriptions,
  createPrescription,
  updatePrescription,
};
