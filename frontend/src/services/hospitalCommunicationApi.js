import { apiFetch } from "../utils/apiFetch";

export async function listHospitalCommunicationTemplates() {
  return apiFetch("/api/hospital-communication/templates");
}

export async function upsertHospitalCommunicationTemplate(payload) {
  return apiFetch("/api/hospital-communication/templates", {
    method: "POST",
    body: payload,
  });
}

export async function getHospitalCommunicationTemplatePreview({ eventType, channel }) {
  const qs = new URLSearchParams({ eventType, channel });
  return apiFetch(`/api/hospital-communication/templates/preview?${qs}`);
}

export async function listHospitalBroadcasts() {
  return apiFetch("/api/hospital-communication/broadcasts");
}

export async function createHospitalBroadcast(payload) {
  return apiFetch("/api/hospital-communication/broadcasts", {
    method: "POST",
    body: payload,
  });
}

export async function sendHospitalBroadcast(broadcastId) {
  return apiFetch(`/api/hospital-communication/broadcasts/${broadcastId}/send`, {
    method: "POST",
  });
}

export async function listHospitalCommunicationAnalytics() {
  return apiFetch("/api/hospital-communication/analytics");
}

export async function listHospitalNotificationLogs() {
  return apiFetch("/api/hospital-communication/logs");
}
