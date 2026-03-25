import apiFetch from "../utils/apiFetch";

const DEFAULT_WARMUP_TIMEOUT_MS = 4500;
const DEFAULT_TIMEOUT_SEQUENCE = [26000, 38000];
const RETRYABLE_ERROR_HINTS = [
  "timed out",
  "network error",
  "failed to fetch",
  "taking longer than usual",
];

const warmPromises = new Map();

function delay(ms) {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
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
  { path = "/healthz", timeoutMs = DEFAULT_WARMUP_TIMEOUT_MS } = {}
) {
  if (!warmPromises.has(key)) {
    const promise = (async () => {
      try {
        await apiFetch(path, { timeoutMs });
        return true;
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
    warmupPath = "/healthz",
    timeoutSequence = DEFAULT_TIMEOUT_SEQUENCE,
  } = {}
) {
  const warmed = await warmConsoleRuntime(warmupKey, { path: warmupPath });
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
      await delay(900 * (attemptIndex + 1));
    }
  }

  throw toConsoleFriendlyError(lastError, warmed, timeoutSequence.length);
}
