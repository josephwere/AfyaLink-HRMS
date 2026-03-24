import apiFetch from "../utils/apiFetch";

function buildQuery(options = {}) {
  const params = new URLSearchParams();
  if (options.hospitalId) params.set("hospitalId", String(options.hospitalId));
  return params.toString();
}

export const getClinicalOrderCopilotSnapshot = async (options = {}) => {
  const query = buildQuery(options);
  return apiFetch(`/api/platform-innovation/clinical-order-copilot${query ? `?${query}` : ""}`);
};

export const getDigitalHospitalTwinSnapshot = async (options = {}) => {
  const query = buildQuery(options);
  return apiFetch(`/api/platform-innovation/digital-twin${query ? `?${query}` : ""}`);
};

export const getInteropMarketplaceSnapshot = async (options = {}) => {
  const query = buildQuery(options);
  return apiFetch(`/api/platform-innovation/interop-marketplace${query ? `?${query}` : ""}`);
};
