import apiFetch from "../utils/apiFetch";
import { downloadApiFile } from "../lib/api/client";

async function downloadCsv(path, filenamePrefix) {
  await downloadApiFile(path, {
    filename: `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`,
    headers: { Accept: "text/csv" },
  });
}

export async function listSreIncidents(params = {}) {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.severity) query.set("severity", params.severity);
  if (params.q) query.set("q", params.q);
  if (params.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return apiFetch(`/api/sre/incidents${qs ? `?${qs}` : ""}`);
}

export async function createSreIncident(payload) {
  return apiFetch("/api/sre/incidents", { method: "POST", body: payload });
}

export async function ackSreIncident(id, payload = {}) {
  return apiFetch(`/api/sre/incidents/${id}/ack`, { method: "POST", body: payload });
}

export async function escalateSreIncident(id, payload = {}) {
  return apiFetch(`/api/sre/incidents/${id}/escalate`, { method: "POST", body: payload });
}

export async function mitigateSreIncident(id, payload = {}) {
  return apiFetch(`/api/sre/incidents/${id}/mitigate`, { method: "POST", body: payload });
}

export async function resolveSreIncident(id, payload = {}) {
  return apiFetch(`/api/sre/incidents/${id}/resolve`, { method: "POST", body: payload });
}

export async function exportSreIncidentsCsv(params = {}) {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.severity) query.set("severity", params.severity);
  if (params.q) query.set("q", params.q);
  if (params.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return downloadCsv(`/api/sre/incidents/export.csv${qs ? `?${qs}` : ""}`, "sre-incidents");
}

export async function listSupportTickets(params = {}) {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.priority) query.set("priority", params.priority);
  if (params.q) query.set("q", params.q);
  if (params.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return apiFetch(`/api/support/tickets${qs ? `?${qs}` : ""}`);
}

export async function createSupportTicket(payload) {
  return apiFetch("/api/support/tickets", { method: "POST", body: payload });
}

export async function updateSupportTicket(id, payload) {
  return apiFetch(`/api/support/tickets/${id}`, { method: "PATCH", body: payload });
}

export async function exportSupportTicketsCsv(params = {}) {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.priority) query.set("priority", params.priority);
  if (params.q) query.set("q", params.q);
  if (params.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return downloadCsv(`/api/support/tickets/export.csv${qs ? `?${qs}` : ""}`, "support-tickets");
}

export async function listPilotOnboarding(params = {}) {
  const query = new URLSearchParams();
  if (params.hospital) query.set("hospital", params.hospital);
  const qs = query.toString();
  return apiFetch(`/api/pilot/onboarding${qs ? `?${qs}` : ""}`);
}

export async function upsertPilotOnboarding(payload) {
  return apiFetch("/api/pilot/onboarding", { method: "POST", body: payload });
}

export async function updatePilotOnboardingItem(id, key, payload = {}) {
  return apiFetch(`/api/pilot/onboarding/${id}/item/${encodeURIComponent(key)}`, {
    method: "PATCH",
    body: payload,
  });
}
