import apiFetch from "../utils/apiFetch";

export const getRevenueIntelligenceSnapshot = async (options = {}) => {
  const params = new URLSearchParams();
  if (options.hospitalId) params.set("hospitalId", String(options.hospitalId));
  const query = params.toString();
  return apiFetch(`/api/financials/intelligence${query ? `?${query}` : ""}`);
};
