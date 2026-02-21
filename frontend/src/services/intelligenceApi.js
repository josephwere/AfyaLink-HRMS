import apiFetch from "../utils/apiFetch";

export const queryNlpAnalytics = async (query) =>
  apiFetch("/api/analytics/nlp/query", { method: "POST", body: { query } });

export const getRegulatoryAutoReport = async () =>
  apiFetch("/api/reports/regulatory/auto");

