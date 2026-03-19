import apiFetch from "../utils/apiFetch";

export const getUnifiedAssistantOverview = (params = {}) => {
  const query = new URLSearchParams();
  if (params.hospitalId) query.set("hospitalId", params.hospitalId);
  const qs = query.toString();
  return apiFetch(`/api/unified-assistant/overview${qs ? `?${qs}` : ""}`);
};

export const getUnifiedAssistantSettings = (params = {}) => {
  const query = new URLSearchParams();
  if (params.hospitalId) query.set("hospitalId", params.hospitalId);
  const qs = query.toString();
  return apiFetch(`/api/unified-assistant/settings${qs ? `?${qs}` : ""}`);
};

export const updateUnifiedAssistantSettings = ({ hospitalId = "", ...body } = {}) => {
  const query = new URLSearchParams();
  if (hospitalId) query.set("hospitalId", hospitalId);
  const qs = query.toString();
  return apiFetch(`/api/unified-assistant/settings${qs ? `?${qs}` : ""}`, {
    method: "PATCH",
    body,
  });
};

export const logUnifiedAssistantHandoff = ({ hospitalId = "", ...body } = {}) => {
  const query = new URLSearchParams();
  if (hospitalId) query.set("hospitalId", hospitalId);
  const qs = query.toString();
  return apiFetch(`/api/unified-assistant/handoff-log${qs ? `?${qs}` : ""}`, {
    method: "POST",
    body,
  });
};

export const searchUnifiedAssistant = ({ q = "", hospitalId = "", limit = 8 } = {}) => {
  const query = new URLSearchParams();
  if (q) query.set("q", q);
  if (hospitalId) query.set("hospitalId", hospitalId);
  if (limit) query.set("limit", String(limit));
  return apiFetch(`/api/unified-assistant/search?${query.toString()}`);
};

export const getUnifiedAssistantRecord = ({ kind, id, hospitalId = "" }) => {
  const query = new URLSearchParams();
  if (hospitalId) query.set("hospitalId", hospitalId);
  const qs = query.toString();
  return apiFetch(`/api/unified-assistant/record/${encodeURIComponent(kind)}/${encodeURIComponent(id)}${qs ? `?${qs}` : ""}`);
};

export const listAssistantChannels = ({ hospitalId = "" } = {}) => {
  const query = new URLSearchParams();
  if (hospitalId) query.set("hospitalId", hospitalId);
  const qs = query.toString();
  return apiFetch(`/api/communication/channels${qs ? `?${qs}` : ""}`);
};

export const listAssistantMessages = ({ channelId, cursor = "", limit = 30 } = {}) => {
  const query = new URLSearchParams();
  if (cursor) query.set("cursor", cursor);
  if (limit) query.set("limit", String(limit));
  return apiFetch(`/api/communication/channels/${encodeURIComponent(channelId)}/messages?${query.toString()}`);
};

export const sendAssistantMessage = ({ channelId, body, attachments = [] }) =>
  apiFetch(`/api/communication/channels/${encodeURIComponent(channelId)}/messages`, {
    method: "POST",
    body: { body, attachments },
  });
