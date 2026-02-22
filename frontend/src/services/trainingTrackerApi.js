import apiFetch from "../utils/apiFetch";

export async function listTrainingTrackers(params = {}) {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.role) query.set("role", params.role);
  if (params.status) query.set("status", params.status);
  if (params.hospital) query.set("hospital", params.hospital);
  if (params.limit) query.set("limit", String(params.limit));
  const q = query.toString();
  return apiFetch(`/api/training/tracker${q ? `?${q}` : ""}`);
}

export async function upsertTrainingTracker(payload) {
  return apiFetch("/api/training/tracker", {
    method: "POST",
    body: payload,
  });
}

export async function updateTrainingDay(id, day, payload = {}) {
  return apiFetch(`/api/training/tracker/${id}/day/${day}`, {
    method: "PATCH",
    body: payload,
  });
}
