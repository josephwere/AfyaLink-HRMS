import { apiFetch } from "../../utils/apiFetch";

export async function listEncounters({ patientId, limit = 25, stage, appointmentId } = {}) {
  const query = new URLSearchParams();
  if (patientId) query.set("patientId", String(patientId));
  if (appointmentId) query.set("appointmentId", String(appointmentId));
  if (stage) query.set("stage", String(stage));
  if (limit) query.set("limit", String(limit));
  const qs = query.toString();
  return apiFetch(`/api/encounters${qs ? `?${qs}` : ""}`);
}

export const list = listEncounters;

export async function get(encounterId) {
  return apiFetch(`/api/encounters/${encodeURIComponent(encounterId)}`);
}

export async function getLatestEncounterForPatient(patientId) {
  if (!patientId) return null;
  const rows = await listEncounters({ patientId, limit: 1 });
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

export const getLatestForPatient = getLatestEncounterForPatient;
