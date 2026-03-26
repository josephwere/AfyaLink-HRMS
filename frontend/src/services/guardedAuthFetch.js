import apiFetch from "../utils/apiFetch";

const AUTH_WARMUP_TIMEOUT_MS = 4000;
const AUTH_WARMUP_MAX_WAIT_MS = 45000;
const AUTH_WARM_OK_TTL_MS = 2 * 60 * 1000;
const AUTH_TIMEOUT_SEQUENCE = [20000, 35000, 50000];
const warmPromises = new Map();
const warmState = new Map();

export function isRetriableAuthMessage(message) {
  const lower = String(message || "").toLowerCase();
  return (
    lower.includes("timed out") ||
    lower.includes("request timed out") ||
    lower.includes("network error") ||
    lower.includes("taking longer than usual") ||
    lower.includes("waking up") ||
    lower.includes("failed to fetch")
  );
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isRetriableAuthError(err) {
  const message = String(err?.message || "").toLowerCase();
  const status = Number(err?.status || 0);
  if (isRetriableAuthMessage(message)) {
    return true;
  }
  return [408, 429, 500, 502, 503, 504].includes(status);
}

function toAuthFriendlyError(err, warmed, attemptsTried) {
  const message = String(err?.message || "");
  const lower = message.toLowerCase();
  if (
    lower.includes("timed out") ||
    lower.includes("network error") ||
    lower.includes("taking longer than usual")
  ) {
    return new Error(
      warmed
        ? "Secure sign-in is taking longer than usual. Please wait a few seconds and try again."
        : `Secure sign-in is waking up. We already retried ${attemptsTried} time${attemptsTried === 1 ? "" : "s"} for you. Please try again in a few seconds.`
    );
  }
  return err instanceof Error ? err : new Error(message || "Authentication failed");
}

export function normalizeAuthUiError(
  err,
  {
    timeoutMessage = "We’re warming secure access and retrying in the background. Please wait a few seconds and try again.",
    networkMessage = "Secure access is temporarily unavailable. Please check your connection and try again.",
    fallback = "Something went wrong. Please try again.",
  } = {}
) {
  const message = String(err?.message || "").trim();
  const lower = message.toLowerCase();

  if (isRetriableAuthMessage(lower)) {
    if (lower.includes("network error") || lower.includes("failed to fetch")) {
      return networkMessage;
    }
    return timeoutMessage;
  }

  return message || fallback;
}

export async function warmAuthRuntime(
  key = "auth-runtime",
  {
    path = "/readyz",
    timeoutMs = AUTH_WARMUP_TIMEOUT_MS,
    maxWaitMs = AUTH_WARMUP_MAX_WAIT_MS,
  } = {}
) {
  const lastOkAt = warmState.get(key);
  if (lastOkAt && Date.now() - lastOkAt < AUTH_WARM_OK_TTL_MS) {
    return true;
  }
  if (!warmPromises.has(key)) {
    const promise = (async () => {
      try {
        const startedAt = Date.now();
        let attempt = 0;
        while (Date.now() - startedAt < maxWaitMs) {
          attempt += 1;
          try {
            await apiFetch(path, {
              method: "GET",
              timeoutMs,
              _skipOfflineQueue: true,
            });
            warmState.set(key, Date.now());
            return true;
          } catch {
            // keep retrying until maxWaitMs
          }
          await sleep(Math.min(1800, 250 + attempt * 220));
        }
        return false;
      } catch {
        return false;
      } finally {
        warmPromises.delete(key);
      }
    })();
    warmPromises.set(key, promise);
  }
  return warmPromises.get(key);
}

export async function guardedAuthFetch(
  path,
  options = {},
  {
    warmupKey = "auth-runtime",
    warmupPath = "/readyz",
    timeoutSequence = AUTH_TIMEOUT_SEQUENCE,
    retryDelayMs = 700,
  } = {}
) {
  const warmed = await warmAuthRuntime(warmupKey, { path: warmupPath });
  let lastError = null;

  for (let index = 0; index < timeoutSequence.length; index += 1) {
    try {
      return await apiFetch(path, {
        ...options,
        timeoutMs: timeoutSequence[index],
        _skipOfflineQueue: true,
      });
    } catch (err) {
      lastError = err;
      if (!isRetriableAuthError(err) || index === timeoutSequence.length - 1) {
        throw toAuthFriendlyError(err, warmed, index + 1);
      }
      await sleep(retryDelayMs * (index + 1));
    }
  }

  throw toAuthFriendlyError(lastError, warmed, timeoutSequence.length);
}
