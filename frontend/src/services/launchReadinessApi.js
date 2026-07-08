import apiFetch from "../utils/apiFetch";

export async function fetchSignals() {
  const [backendHealth, aiGatewayHealth, systemSettings, offlineOps, trainingTracker] =
    await Promise.all([
      apiFetch("/health").catch(() => null),
      apiFetch("/api/ai/gateway/health").catch(() => null),
      apiFetch("/api/system-settings").catch(() => null),
      apiFetch("/api/offline/status").catch(() => null),
      apiFetch("/api/training/tracker?limit=1").catch(() => null),
    ]);

  return {
    backendHealth,
    aiGatewayHealth,
    systemSettings,
    offlineOps,
    trainingTracker,
  };
}
