import { apiFetch } from "../utils/apiFetch";

export async function listCommunicationChannels() {
  return apiFetch("/api/communication/channels");
}

export async function bootstrapCommunicationChannels() {
  return apiFetch("/api/communication/bootstrap", { method: "POST" });
}

export async function listCommunicationMessages(channelId, cursor = null) {
  const qs = new URLSearchParams();
  if (cursor) qs.set("cursor", cursor);
  qs.set("limit", "30");
  return apiFetch(`/api/communication/channels/${channelId}/messages?${qs}`);
}

export async function sendCommunicationMessage(channelId, payload) {
  return apiFetch(`/api/communication/channels/${channelId}/messages`, {
    method: "POST",
    body: payload,
  });
}
