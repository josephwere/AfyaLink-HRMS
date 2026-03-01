import apiFetch from "../utils/apiFetch";

export const getAssistantContext = () => apiFetch("/api/ai/assistant/context");

export const updateAssistantProfile = (assistantProfile) =>
  apiFetch("/api/ai/assistant/profile", {
    method: "PUT",
    body: { assistantProfile },
  });

export const getAssistantAdvice = (payload) =>
  apiFetch("/api/ai/assistant/advice", {
    method: "POST",
    body: payload || {},
  });

