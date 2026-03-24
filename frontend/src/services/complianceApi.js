import apiFetch from "../utils/apiFetch";
import { guardedConsoleFetch } from "./guardedConsoleFetch";

export const getComplianceCenter = async () =>
  guardedConsoleFetch("/api/compliance/center", {
    warmupKey: "compliance-center",
  });

export const createComplianceLegalHold = async (payload) =>
  apiFetch("/api/compliance/legal-holds", {
    method: "POST",
    body: payload,
  });

export const releaseComplianceLegalHold = async (id, payload = {}) =>
  apiFetch(`/api/compliance/legal-holds/${id}/release`, {
    method: "POST",
    body: payload,
  });
