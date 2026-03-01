import apiFetch from "../utils/apiFetch";

export const listCustomizationRequests = () => apiFetch("/api/customization-requests");

export const createCustomizationRequest = (payload) =>
  apiFetch("/api/customization-requests", {
    method: "POST",
    body: payload,
  });

export const updateCustomizationRequestStatus = (id, payload) =>
  apiFetch(`/api/customization-requests/${id}/status`, {
    method: "PATCH",
    body: payload,
  });

