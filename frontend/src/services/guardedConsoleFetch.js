import apiFetch from "../utils/apiFetch";

const DEFAULT_WARMUP_TIMEOUT_MS = 4500;
const DEFAULT_WARMUP_MAX_WAIT_MS = 9000;
const DEFAULT_WARM_OK_TTL_MS = 2 * 60 * 1000;
const DEFAULT_TIMEOUT_SEQUENCE = [9000, 14000];
const RETRYABLE_ERROR_HINTS = [
  "timed out",
  "network error",
  "failed to fetch",
  "taking longer than usual",
];

const warmPromises = new Map();
const warmState = new Map();

function delay(ms) {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

function isWarmCached(key) {
  const lastOkAt = warmState.get(key);
  if (!lastOkAt) return false;
  return Date.now() - lastOkAt < DEFAULT_WARM_OK_TTL_MS;
}

function isRetryableConsoleError(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    RETRYABLE_ERROR_HINTS.some((hint) => message.includes(hint)) ||
    Number(error?.status || 0) >= 500
  );
}

function toConsoleFriendlyError(error, warmed, attempts) {
  const message = String(error?.message || "").toLowerCase();
  if (isRetryableConsoleError(error) || RETRYABLE_ERROR_HINTS.some((hint) => message.includes(hint))) {
    return new Error(
      warmed
        ? "Workspace data is taking longer than usual. Please wait a few seconds and try again."
        : `Workspace services are warming up. We already retried ${attempts} time${attempts === 1 ? "" : "s"} for you. Please try again in a few seconds.`
    );
  }
  return error instanceof Error ? error : new Error(String(error?.message || "Failed to load workspace"));
}

export async function warmConsoleRuntime(
  key = "default",
  {
    path = "/readyz",
    timeoutMs = DEFAULT_WARMUP_TIMEOUT_MS,
    maxWaitMs = DEFAULT_WARMUP_MAX_WAIT_MS,
  } = {}
) {
  if (isWarmCached(key)) return true;
  if (!warmPromises.has(key)) {
    const promise = (async () => {
      try {
        const startedAt = Date.now();
        let attempt = 0;
        while (Date.now() - startedAt < maxWaitMs) {
          attempt += 1;
          try {
            await apiFetch(path, { timeoutMs, _skipOfflineQueue: true });
            warmState.set(key, Date.now());
            return true;
          } catch {
            // keep retrying until maxWaitMs
          }
          await delay(Math.min(1800, 250 + attempt * 220));
        }
        return false;
      } catch {
        return false;
      }
    })().finally(() => {
      warmPromises.delete(key);
    });
    warmPromises.set(key, promise);
  }
  return warmPromises.get(key);
}

export async function guardedConsoleFetch(
  path,
  {
    requestOptions = {},
    warmupKey = "default",
    warmupPath = "/readyz",
    timeoutSequence = DEFAULT_TIMEOUT_SEQUENCE,
  } = {}
) {
  const runtimeKey = warmupPath === "/readyz" ? "backend-ready" : warmupKey;
  let warmed = false;
  let lastError = null;

  for (let attemptIndex = 0; attemptIndex < timeoutSequence.length; attemptIndex += 1) {
    const timeoutMs = timeoutSequence[attemptIndex];
    try {
      const payload = await apiFetch(path, { ...requestOptions, timeoutMs });
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
      if (
        !isRetryableConsoleError(error) ||
        attemptIndex === timeoutSequence.length - 1
      ) {
        break;
      }
      if (!warmed) {
        warmConsoleRuntime(runtimeKey, { path: warmupPath }).then((ok) => {
          warmed = Boolean(ok);
        });
      }
      await delay(900 * (attemptIndex + 1));
    }
  }

  throw toConsoleFriendlyError(lastError, warmed, timeoutSequence.length);
}
