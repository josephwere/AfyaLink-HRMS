import apiFetch from "../utils/apiFetch";

export function listLabOpsRecords(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || String(value) === "") return;
    query.set(key, String(value));
  });
  const qs = query.toString();
  return apiFetch(`/api/lab-ops${qs ? `?${qs}` : ""}`);
}

export function createLabOpsRecord(payload) {
  return apiFetch("/api/lab-ops", {
    method: "POST",
    body: payload,
  });
}
