import { apiFetch } from "../utils/apiFetch";

export async function listAppointments(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== "") {
      qs.set(key, String(value));
    }
  });
  return apiFetch(`/api/appointments${qs.toString() ? `?${qs.toString()}` : ""}`);
}

export async function getAppointment(id) {
  return apiFetch(`/api/appointments/${encodeURIComponent(id)}`);
}

export async function updateAppointment(id, payload) {
  return apiFetch(`/api/appointments/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteAppointment(id) {
  return apiFetch(`/api/appointments/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function createAppointment(payload) {
  return apiFetch("/api/appointments", {
    method: "POST",
    body: payload,
  });
}

export async function listDoctorAvailability(doctorId) {
  return apiFetch(`/api/appointments/doctors/${encodeURIComponent(doctorId)}/availability`);
}

export async function getDoctorAvailability(doctorId) {
  return listDoctorAvailability(doctorId);
}

export async function listAppointmentsForHospital(hospitalId, params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== "") {
      qs.set(key, String(value));
    }
  });
  return apiFetch(`/api/appointments/hospital/${encodeURIComponent(hospitalId)}${qs.toString() ? `?${qs.toString()}` : ""}`);
}

export async function listHospitalDoctors(hospitalId) {
  return apiFetch(`/api/appointments/doctors?hospitalId=${encodeURIComponent(hospitalId)}`);
}

export async function listAppointmentSuggestions(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== "") {
      qs.set(key, String(value));
    }
  });
  return apiFetch(`/api/appointments/suggestions${qs.toString() ? `?${qs.toString()}` : ""}`);
}

export async function createAppointmentCall(payload) {
  return apiFetch("/api/appointments/calls", {
    method: "POST",
    body: payload,
  });
}

export async function saveDoctorAvailability(doctorId, payload) {
  return apiFetch(`/api/appointments/doctors/${encodeURIComponent(doctorId)}/availability`, {
    method: "PUT",
    body: payload,
  });
}

export async function listAppointmentCalls(params = {}) {
  const normalizedParams = typeof params === "string" ? { hospitalId: params } : params || {};
  const qs = new URLSearchParams();
  Object.entries(normalizedParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== "") {
      qs.set(key, String(value));
    }
  });
  return apiFetch(`/api/appointments/calls${qs.toString() ? `?${qs.toString()}` : ""}`);
}

export async function updateAppointmentCall(callId, action) {
  return apiFetch(`/api/appointments/calls/${encodeURIComponent(callId)}/${action}`, {
    method: "PATCH",
  });
}

export async function assignAppointmentDoctor(appointmentId, doctorId) {
  return apiFetch(`/api/appointments/${encodeURIComponent(appointmentId)}/assign`, {
    method: "POST",
    body: {
      doctorId: doctorId || undefined,
    },
  });
}

export async function deleteAppointmentCall(callId) {
  return apiFetch(`/api/appointments/calls/${encodeURIComponent(callId)}`, {
    method: "DELETE",
  });
}

export async function listAppointmentOperationsQueue() {
  return apiFetch("/api/appointments/ops/queue");
}

export default {
  listAppointments,
  getAppointment,
  updateAppointment,
  deleteAppointment,
  createAppointment,
  listDoctorAvailability,
  getDoctorAvailability,
  listAppointmentsForHospital,
  listHospitalDoctors,
  listAppointmentSuggestions,
  saveDoctorAvailability,
  listAppointmentCalls,
  createAppointmentCall,
  updateAppointmentCall,
  assignAppointmentDoctor,
  deleteAppointmentCall,
  listAppointmentOperationsQueue,
};
