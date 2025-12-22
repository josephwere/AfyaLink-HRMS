import { apiFetch } from "../utils/auth";

export async function createAppointment(payload) {
  return apiFetch("/api/appointments", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
