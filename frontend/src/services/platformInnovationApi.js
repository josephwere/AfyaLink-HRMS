import { guardedConsoleFetch } from "./guardedConsoleFetch";

function buildQuery(options = {}) {
  const params = new URLSearchParams();
  if (options.hospitalId) params.set("hospitalId", String(options.hospitalId));
  return params.toString();
}

async function fetchInnovationSnapshot(slug, options = {}) {
  const query = buildQuery(options);
  const path = `/api/platform-innovation/${slug}${query ? `?${query}` : ""}`;
  return guardedConsoleFetch(path, { warmupKey: "platform-innovation" });
}

export const getClinicalOrderCopilotSnapshot = async (options = {}) => {
  return fetchInnovationSnapshot("clinical-order-copilot", options);
};

export const getDigitalHospitalTwinSnapshot = async (options = {}) => {
  return fetchInnovationSnapshot("digital-twin", options);
};

export const getInteropMarketplaceSnapshot = async (options = {}) => {
  return fetchInnovationSnapshot("interop-marketplace", options);
};
