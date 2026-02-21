import apiFetch from "../utils/apiFetch";

export const listMappings = async () => apiFetch("/api/mapping");

export const createMapping = async (payload) =>
  apiFetch("/api/mapping", { method: "POST", body: payload });

export const updateMapping = async (id, payload) =>
  apiFetch(`/api/mapping/${id}`, { method: "PUT", body: payload });

export const deleteMapping = async (id) =>
  apiFetch(`/api/mapping/${id}`, { method: "DELETE" });

export const listMappingTemplates = async () =>
  apiFetch("/api/mapping/catalog/templates");

export const previewMapping = async (payload) =>
  apiFetch("/api/mapping/preview", { method: "POST", body: payload });

export const signMappingPayload = async (payload) =>
  apiFetch("/api/mapping/sign", { method: "POST", body: payload });

export const verifyMappingPayload = async (payload) =>
  apiFetch("/api/mapping/verify", { method: "POST", body: payload });

