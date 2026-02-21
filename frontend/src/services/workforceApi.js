import api from "./api";

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
  api.get(`/api/workforce/leave${buildQuery(status, options)}`);
export const listMyLeave = (status, options) =>
  api.get(`/api/workforce/leave/my${buildQuery(status, options)}`);
export const createLeave = (payload) =>
  api.post("/api/workforce/leave", payload);
export const approveLeave = (id) =>
  api.post(`/api/workforce/leave/${id}/approve`);
export const rejectLeave = (id, reason) =>
  api.post(`/api/workforce/leave/${id}/reject`, { reason });

export const listOvertime = (status, options) =>
  api.get(`/api/workforce/overtime${buildQuery(status, options)}`);
export const listMyOvertime = (status, options) =>
  api.get(`/api/workforce/overtime/my${buildQuery(status, options)}`);
export const createOvertime = (payload) =>
  api.post("/api/workforce/overtime", payload);
export const approveOvertime = (id) =>
  api.post(`/api/workforce/overtime/${id}/approve`);
export const rejectOvertime = (id, reason) =>
  api.post(`/api/workforce/overtime/${id}/reject`, { reason });

export const listShifts = (status, options) =>
  api.get(`/api/workforce/shifts${buildQuery(status, options)}`);
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
  return api.get(`/api/workforce/pending${q ? `?${q}` : ""}`);
};
export const listMyShifts = (status, options) =>
  api.get(`/api/workforce/shifts/my${buildQuery(status, options)}`);
export const createShift = (payload) =>
  api.post("/api/workforce/shifts", payload);
export const approveShift = (id) =>
  api.post(`/api/workforce/shifts/${id}/approve`);
export const rejectShift = (id, reason) =>
  api.post(`/api/workforce/shifts/${id}/reject`, { reason });

export const getWorkforceSlaPolicies = () =>
  api.get("/api/workforce/sla/policies");

export const updateWorkforceSlaPolicy = (requestType, payload) =>
  api.put(`/api/workforce/sla/policies/${requestType}`, payload);

export const getWorkforceQueueInsights = () =>
  api.get("/api/workforce/queue-insights");

export const getWorkforceAutomationPolicies = () =>
  api.get("/api/workforce/automation/policies");

export const getWorkforceAutomationPresets = (params = {}) => {
  const q = new URLSearchParams();
  if (params.includeInactive) q.set("includeInactive", "1");
  const qs = q.toString();
  return api.get(`/api/workforce/automation/presets${qs ? `?${qs}` : ""}`);
};

export const applyWorkforceAutomationPresetAll = (presetKey) =>
  api.post("/api/workforce/automation/presets/apply-all", { presetKey });

export const upsertWorkforceAutomationPreset = (payload) =>
  api.post("/api/workforce/automation/presets", payload);

export const deactivateWorkforceAutomationPreset = (key) =>
  api.delete(`/api/workforce/automation/presets/${encodeURIComponent(String(key || "").toUpperCase())}`);

export const reactivateWorkforceAutomationPreset = (key) =>
  api.post(`/api/workforce/automation/presets/${encodeURIComponent(String(key || "").toUpperCase())}/reactivate`);

export const getWorkforceAutomationPresetHistory = (params = {}) => {
  const q = new URLSearchParams();
  if (params.limit) q.set("limit", String(params.limit));
  const qs = q.toString();
  return api.get(`/api/workforce/automation/presets/history${qs ? `?${qs}` : ""}`);
};

export const updateWorkforceAutomationPolicy = (requestType, payload) =>
  api.put(`/api/workforce/automation/policies/${requestType}`, payload);

export const simulateWorkforceAutomation = (payload) =>
  api.post("/api/workforce/automation/simulate", payload);

export const previewWorkforceEscalation = (params = {}) => {
  const query = new URLSearchParams();
  if (params.requestType) query.set("requestType", String(params.requestType).toUpperCase());
  if (params.limit) query.set("limit", String(params.limit));
  const q = query.toString();
  return api.get(`/api/workforce/automation/preview${q ? `?${q}` : ""}`);
};

export const runWorkforceAutomationSweep = () =>
  api.post("/api/workforce/automation/sweep");
