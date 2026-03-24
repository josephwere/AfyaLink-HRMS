import apiFetch from "../utils/apiFetch";

function buildQuery(options = {}) {
  const params = new URLSearchParams();
  if (options.hospitalId) params.set("hospitalId", String(options.hospitalId));
  return params.toString();
}

const WARMUP_TIMEOUT_MS = 4500;
const SNAPSHOT_TIMEOUTS_MS = [26000, 38000];
const RETRYABLE_ERROR_HINTS = ["timed out", "network error", "failed to fetch"];

let runtimeWarmPromise = null;

function delay(ms) {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

function isRetryableInnovationError(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    RETRYABLE_ERROR_HINTS.some((hint) => message.includes(hint)) ||
    Number(error?.status || 0) >= 500
  );
}

export async function warmPlatformInnovationRuntime() {
  if (!runtimeWarmPromise) {
    runtimeWarmPromise = (async () => {
      try {
        await apiFetch("/healthz", {
          timeoutMs: WARMUP_TIMEOUT_MS,
        });
        return true;
      } catch {
        return false;
      }
    })().finally(() => {
      runtimeWarmPromise = null;
    });
  }
  return runtimeWarmPromise;
}

async function fetchInnovationSnapshot(slug, options = {}) {
  const query = buildQuery(options);
  const path = `/api/platform-innovation/${slug}${query ? `?${query}` : ""}`;
  const warmed = await warmPlatformInnovationRuntime();
  let lastError = null;

  for (let attemptIndex = 0; attemptIndex < SNAPSHOT_TIMEOUTS_MS.length; attemptIndex += 1) {
    const timeoutMs = SNAPSHOT_TIMEOUTS_MS[attemptIndex];
    try {
      const payload = await apiFetch(path, { timeoutMs });
      return {
        payload,
        clientMeta: {
          warmed,
          attempts: attemptIndex + 1,
          timeoutMs,
          loadedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      lastError = error;
      if (!isRetryableInnovationError(error) || attemptIndex === SNAPSHOT_TIMEOUTS_MS.length - 1) {
        break;
      }
      await delay(900 * (attemptIndex + 1));
    }
  }

  throw lastError;
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
