import apiFetch from "../utils/apiFetch";

export function pushOfflineClientMetrics(payload) {
  return apiFetch("/api/offline/metrics", {
    method: "POST",
    body: payload,
    _skipOfflineQueue: true,
  });
}

export function getOfflineOpsMetrics(params = {}) {
  const qs = new URLSearchParams();
  if (params.hospitalId) qs.set("hospitalId", String(params.hospitalId));
  if (params.hours) qs.set("hours", String(params.hours));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.q) qs.set("q", String(params.q));
  return apiFetch(`/api/offline/metrics${qs.toString() ? `?${qs.toString()}` : ""}`);
}

export function getOfflineQueueStatus() {
  return apiFetch("/api/offline/status");
}

