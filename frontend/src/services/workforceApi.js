import apiFetch from "../utils/apiFetch";

const buildQuery = (status, options = {}) => {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (options.limit) params.set("limit", String(options.limit));
  if (options.cursor !== undefined && options.cursor !== null) {
    params.set("cursor", options.cursor);
  }
  if (options.cursorMode) params.set("cursorMode", "1");
  const q = params.toString();
  return q ? `?${q}` : "";
};

export const listLeave = (status, options) =>
  apiFetch(`/api/workforce/leave${buildQuery(status, options)}`);
export const listMyLeave = (status, options) =>
  apiFetch(`/api/workforce/leave/my${buildQuery(status, options)}`);
export const createLeave = (payload) =>
  apiFetch("/api/workforce/leave", { method: "POST", body: payload });
export const approveLeave = (id) =>
  apiFetch(`/api/workforce/leave/${id}/approve`, { method: "POST" });
export const rejectLeave = (id, reason) =>
  apiFetch(`/api/workforce/leave/${id}/reject`, {
    method: "POST",
    body: { reason },
  });

export const listOvertime = (status, options) =>
  apiFetch(`/api/workforce/overtime${buildQuery(status, options)}`);
export const listMyOvertime = (status, options) =>
  apiFetch(`/api/workforce/overtime/my${buildQuery(status, options)}`);
export const createOvertime = (payload) =>
  apiFetch("/api/workforce/overtime", { method: "POST", body: payload });
export const approveOvertime = (id) =>
  apiFetch(`/api/workforce/overtime/${id}/approve`, { method: "POST" });
export const rejectOvertime = (id, reason) =>
  apiFetch(`/api/workforce/overtime/${id}/reject`, {
    method: "POST",
    body: { reason },
  });

export const listShifts = (status, options) =>
  apiFetch(`/api/workforce/shifts${buildQuery(status, options)}`);
export const listPendingQueue = (kind, status, options = {}) => {
  const params = new URLSearchParams();
  params.set("kind", String(kind || "").toUpperCase());
  if (status) params.set("status", status);
  if (options.limit) params.set("limit", String(options.limit));
  if (options.cursor !== undefined && options.cursor !== null) {
    params.set("cursor", options.cursor);
  }
  if (options.cursorMode) params.set("cursorMode", "1");
  const q = params.toString();
  return apiFetch(`/api/workforce/pending${q ? `?${q}` : ""}`);
};
export const listMyShifts = (status, options) =>
  apiFetch(`/api/workforce/shifts/my${buildQuery(status, options)}`);
export const createShift = (payload) =>
  apiFetch("/api/workforce/shifts", { method: "POST", body: payload });
export const approveShift = (id) =>
  apiFetch(`/api/workforce/shifts/${id}/approve`, { method: "POST" });
export const rejectShift = (id, reason) =>
  apiFetch(`/api/workforce/shifts/${id}/reject`, {
    method: "POST",
    body: { reason },
  });

export const getWorkforceSlaPolicies = () =>
  apiFetch("/api/workforce/sla/policies");

export const updateWorkforceSlaPolicy = (requestType, payload) =>
  apiFetch(`/api/workforce/sla/policies/${requestType}`, {
    method: "PUT",
    body: payload,
  });

export const getWorkforceQueueInsights = () =>
  apiFetch("/api/workforce/queue-insights");

export const getWorkforceAutomationPolicies = () =>
  apiFetch("/api/workforce/automation/policies");

export const getWorkforceAutomationPresets = (params = {}) => {
  const q = new URLSearchParams();
  if (params.includeInactive) q.set("includeInactive", "1");
  const qs = q.toString();
  return apiFetch(`/api/workforce/automation/presets${qs ? `?${qs}` : ""}`);
};

export const applyWorkforceAutomationPresetAll = (presetKey) =>
  apiFetch("/api/workforce/automation/presets/apply-all", {
    method: "POST",
    body: { presetKey },
  });

export const upsertWorkforceAutomationPreset = (payload) =>
  apiFetch("/api/workforce/automation/presets", {
    method: "POST",
    body: payload,
  });

export const deactivateWorkforceAutomationPreset = (key) =>
  apiFetch(`/api/workforce/automation/presets/${encodeURIComponent(String(key || "").toUpperCase())}`, {
    method: "DELETE",
  });

export const reactivateWorkforceAutomationPreset = (key) =>
  apiFetch(`/api/workforce/automation/presets/${encodeURIComponent(String(key || "").toUpperCase())}/reactivate`, {
    method: "POST",
  });

export const getWorkforceAutomationPresetHistory = (params = {}) => {
  const q = new URLSearchParams();
  if (params.limit) q.set("limit", String(params.limit));
  const qs = q.toString();
  return apiFetch(`/api/workforce/automation/presets/history${qs ? `?${qs}` : ""}`);
};

export const updateWorkforceAutomationPolicy = (requestType, payload) =>
  apiFetch(`/api/workforce/automation/policies/${requestType}`, {
    method: "PUT",
    body: payload,
  });

export const simulateWorkforceAutomation = (payload) =>
  apiFetch("/api/workforce/automation/simulate", {
    method: "POST",
    body: payload,
  });

export const previewWorkforceEscalation = (params = {}) => {
  const query = new URLSearchParams();
  if (params.requestType) query.set("requestType", String(params.requestType).toUpperCase());
  if (params.limit) query.set("limit", String(params.limit));
  const q = query.toString();
  return apiFetch(`/api/workforce/automation/preview${q ? `?${q}` : ""}`);
};

export const runWorkforceAutomationSweep = () =>
  apiFetch("/api/workforce/automation/sweep", { method: "POST" });
