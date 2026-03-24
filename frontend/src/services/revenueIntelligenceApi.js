import { guardedConsoleFetch } from "./guardedConsoleFetch";

export const getRevenueIntelligenceSnapshot = async (options = {}) => {
  const params = new URLSearchParams();
  if (options.hospitalId) params.set("hospitalId", String(options.hospitalId));
  const query = params.toString();
  return guardedConsoleFetch(`/api/financials/intelligence${query ? `?${query}` : ""}`, {
    warmupKey: "revenue-intelligence",
  });
};
