import "../config/loadEnv.js";
import fetch from "node-fetch";

const DEFAULT_TIMEOUT_MS = Number(process.env.NEUROEDGE_TIMEOUT_MS || 30000);
const DEFAULT_RETRIES = Math.max(0, Number(process.env.NEUROEDGE_RETRIES || 2));
const DEFAULT_RETRY_BACKOFF_MS = Math.max(0, Number(process.env.NEUROEDGE_RETRY_BACKOFF_MS || 300));
const DEFAULT_CIRCUIT_THRESHOLD = Math.max(1, Number(process.env.NEUROEDGE_CIRCUIT_THRESHOLD || 5));
const DEFAULT_CIRCUIT_COOLDOWN_MS = Math.max(
  1000,
  Number(process.env.NEUROEDGE_CIRCUIT_COOLDOWN_MS || 15000)
);

const circuitState = new Map();

function parseRetryAfterMs(value) {
  if (value == null || value === "") return 0;
  const raw = String(value).trim();
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1000);
  }
  const timestamp = Date.parse(raw);
  if (!Number.isNaN(timestamp)) {
    return Math.max(0, timestamp - Date.now());
  }
  return 0;
}

function toRetryAfterSeconds(retryAfterMs) {
  const safeMs = Math.max(0, Number(retryAfterMs || 0));
  return safeMs > 0 ? Math.max(1, Math.ceil(safeMs / 1000)) : 0;
}

function buildRateLimitMessage(retryAfterMs = 0) {
  const seconds = toRetryAfterSeconds(retryAfterMs);
  if (seconds > 0) {
    return `NeuroEdge is busy right now. Please try again in about ${seconds} seconds.`;
  }
  return "NeuroEdge is busy right now. Please try again shortly.";
}

function computeRetryDelayMs(attempt, retryAfterMs = 0) {
  const exponentialBackoffMs = DEFAULT_RETRY_BACKOFF_MS * 2 ** Math.max(0, Number(attempt || 0));
  return Math.max(exponentialBackoffMs, Math.max(0, Number(retryAfterMs || 0)));
}

function getBaseUrls() {
  const primary = String(process.env.NEUROEDGE_API_BASE || "").trim();
  const failover = String(process.env.NEUROEDGE_API_BASE_FAILOVER || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  return Array.from(new Set([primary, ...failover].filter(Boolean))).map((u) => u.replace(/\/+$/, ""));
}

function getAuthHeaders() {
  const apiKey = process.env.NEUROEDGE_API_KEY;
  const bearerToken = process.env.NEUROEDGE_BEARER_TOKEN;
  if (bearerToken) {
    return { Authorization: `Bearer ${bearerToken}` };
  }
  if (apiKey) {
    return { Authorization: `Bearer ${apiKey}` };
  }
  return {};
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseTextAsJsonSafe(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractCompletionText(payload) {
  const direct =
    payload?.text ||
    payload?.answer ||
    payload?.message ||
    payload?.output_text ||
    payload?.content;
  if (typeof direct === "string" && direct.trim()) {
    return direct.trim();
  }

  const messageContent = payload?.choices?.[0]?.message?.content;
  if (typeof messageContent === "string" && messageContent.trim()) {
    return messageContent.trim();
  }
  if (Array.isArray(messageContent)) {
    const combined = messageContent
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object") return part.text || part.content || "";
        return "";
      })
      .join("\n")
      .trim();
    if (combined) return combined;
  }

  const choiceText = payload?.choices?.[0]?.text;
  if (typeof choiceText === "string" && choiceText.trim()) {
    return choiceText.trim();
  }

  return "";
}

function extractStreamDelta(payload) {
  const deltaContent = payload?.choices?.[0]?.delta?.content;
  if (typeof deltaContent === "string" && deltaContent.trim()) {
    return deltaContent;
  }
  if (Array.isArray(deltaContent)) {
    const combined = deltaContent
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object") return part.text || part.content || "";
        return "";
      })
      .join("");
    if (combined.trim()) return combined;
  }
  return extractCompletionText(payload);
}

function buildStreamMeta(baseMeta = {}, additions = {}) {
  return {
    ...baseMeta,
    ...additions,
  };
}

function emitStreamChunk(onChunk, chunk, meta = {}) {
  const text = typeof chunk === "string" ? chunk : "";
  if (!text) return;
  onChunk?.(text, meta);
}

function finalizeStreamFrame(frameText, onChunk, baseMeta = {}) {
  const trimmed = String(frameText || "").trim();
  if (!trimmed || trimmed === "[DONE]") return { text: "", done: trimmed === "[DONE]" };

  const payload = parseTextAsJsonSafe(trimmed);
  const text = payload ? extractStreamDelta(payload) : trimmed;
  emitStreamChunk(onChunk, text, buildStreamMeta(baseMeta, { payload }));
  return { text, payload, done: false };
}

async function consumeReadableStream(response, { onChunk } = {}) {
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  const isEventStream = contentType.includes("text/event-stream");
  const reader = response.body?.getReader?.();
  if (!reader) {
    const text = await response.text();
    const payload = parseTextAsJsonSafe(text);
    const finalText = payload ? extractCompletionText(payload) : String(text || "").trim();
    emitStreamChunk(onChunk, finalText, buildStreamMeta({}, { payload }));
    return {
      text: finalText,
      payload,
      chunkCount: finalText ? 1 : 0,
    };
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let combined = "";
  let chunkCount = 0;

  const flushLineBuffer = (flushRemainder = false) => {
    const lines = buffer.split(/\r?\n/);
    if (!flushRemainder) {
      buffer = lines.pop() ?? "";
    } else {
      buffer = "";
    }
    for (const line of lines) {
      const frame = finalizeStreamFrame(line, onChunk, { contentType, format: "ndjson" });
      if (frame.text) {
        combined += frame.text;
        chunkCount += 1;
      }
    }
  };

  const flushEventBuffer = (flushRemainder = false) => {
    buffer = buffer.replace(/\r\n/g, "\n");
    let index = buffer.indexOf("\n\n");
    while (index >= 0) {
      const frameText = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      const payloadText = frameText
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");
      const frame = finalizeStreamFrame(payloadText, onChunk, {
        contentType,
        format: "sse",
      });
      if (frame.text) {
        combined += frame.text;
        chunkCount += 1;
      }
      if (frame.done) {
        buffer = "";
        break;
      }
      index = buffer.indexOf("\n\n");
    }

    if (flushRemainder && buffer.trim()) {
      const payloadText = buffer
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");
      const frame = finalizeStreamFrame(payloadText, onChunk, {
        contentType,
        format: "sse-tail",
      });
      if (frame.text) {
        combined += frame.text;
        chunkCount += 1;
      }
      buffer = "";
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    if (isEventStream) {
      flushEventBuffer(false);
    } else {
      flushLineBuffer(false);
    }
  }

  buffer += decoder.decode();
  if (isEventStream) {
    flushEventBuffer(true);
  } else {
    flushLineBuffer(true);
    if (buffer.trim()) {
      const tail = finalizeStreamFrame(buffer, onChunk, {
        contentType,
        format: "tail",
      });
      if (tail.text) {
        combined += tail.text;
        chunkCount += 1;
      }
      buffer = "";
    }
  }

  return {
    text: combined,
    payload: combined ? { text: combined } : null,
    chunkCount,
  };
}

export class NeuroEdgeGatewayError extends Error {
  constructor(message, { status = 502, code = "NEUROEDGE_ERROR", details = null } = {}) {
    super(message);
    this.name = "NeuroEdgeGatewayError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function isRetriableStatus(status) {
  return status === 408 || status === 409 || status === 425 || status === 429 || (status >= 500 && status <= 599);
}

function getCircuit(url) {
  if (!circuitState.has(url)) {
    circuitState.set(url, {
      consecutiveFailures: 0,
      openedAt: null,
      cooldownMs: DEFAULT_CIRCUIT_COOLDOWN_MS,
      reason: "",
      retryAfterMs: 0,
    });
  }
  return circuitState.get(url);
}

function isCircuitOpen(url) {
  const c = getCircuit(url);
  if (!c.openedAt) return false;
  if (Date.now() - c.openedAt >= Number(c.cooldownMs || DEFAULT_CIRCUIT_COOLDOWN_MS)) {
    c.openedAt = null;
    c.consecutiveFailures = 0;
    c.cooldownMs = DEFAULT_CIRCUIT_COOLDOWN_MS;
    c.reason = "";
    c.retryAfterMs = 0;
    return false;
  }
  return true;
}

function getCircuitRetryAfterMs(url) {
  const c = getCircuit(url);
  if (!c.openedAt) return 0;
  return Math.max(0, Number(c.cooldownMs || DEFAULT_CIRCUIT_COOLDOWN_MS) - (Date.now() - c.openedAt));
}

function buildCircuitOpenError(url) {
  const c = getCircuit(url);
  const retryAfterMs = getCircuitRetryAfterMs(url);
  const reason = c.reason || "NEUROEDGE_CIRCUIT_OPEN";
  const message =
    reason === "NEUROEDGE_RATE_LIMITED"
      ? buildRateLimitMessage(retryAfterMs || c.retryAfterMs)
      : "NeuroEdge is temporarily unavailable. Please try again shortly.";
  return new NeuroEdgeGatewayError(message, {
    status: reason === "NEUROEDGE_RATE_LIMITED" ? 429 : 503,
    code: reason === "NEUROEDGE_RATE_LIMITED" ? "NEUROEDGE_RATE_LIMITED" : "NEUROEDGE_CIRCUIT_OPEN",
    details: {
      circuitOpen: true,
      retryAfterMs: retryAfterMs || c.retryAfterMs || 0,
      retryAfterSeconds: toRetryAfterSeconds(retryAfterMs || c.retryAfterMs || 0),
      circuitReason: reason,
      retryable: true,
    },
  });
}

function markSuccess(url) {
  const c = getCircuit(url);
  c.consecutiveFailures = 0;
  c.openedAt = null;
  c.cooldownMs = DEFAULT_CIRCUIT_COOLDOWN_MS;
  c.reason = "";
  c.retryAfterMs = 0;
}

function markFailure(url, error = null) {
  const c = getCircuit(url);
  c.consecutiveFailures += 1;
  const retryAfterMs = Math.max(0, Number(error?.details?.retryAfterMs || 0));
  if (Number(error?.status || 0) === 429 || error?.code === "NEUROEDGE_RATE_LIMITED") {
    c.openedAt = Date.now();
    c.cooldownMs = Math.max(DEFAULT_CIRCUIT_COOLDOWN_MS, retryAfterMs);
    c.reason = "NEUROEDGE_RATE_LIMITED";
    c.retryAfterMs = retryAfterMs;
    return;
  }
  if (c.consecutiveFailures >= DEFAULT_CIRCUIT_THRESHOLD) {
    c.openedAt = Date.now();
    c.cooldownMs = Math.max(DEFAULT_CIRCUIT_COOLDOWN_MS, retryAfterMs);
    c.reason = error?.code || "NEUROEDGE_CIRCUIT_OPEN";
    c.retryAfterMs = retryAfterMs;
  }
}

async function callOneBase(baseUrl, path, { method = "POST", body, correlationId, idempotencyKey } = {}) {
  const url = `${baseUrl}${path}`;
  const headers = {
    "Content-Type": "application/json",
    ...getAuthHeaders(),
  };
  if (correlationId) headers["X-Correlation-Id"] = correlationId;
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  let attempt = 0;
  let lastError = null;
  while (attempt <= DEFAULT_RETRIES) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const text = await res.text();
      const json = parseTextAsJsonSafe(text);
      if (!res.ok) {
        const retryAfterMs = parseRetryAfterMs(res.headers.get("retry-after"));
        const message =
          res.status === 429
            ? buildRateLimitMessage(retryAfterMs)
            : json?.message ||
              json?.error ||
              `NeuroEdge request failed with status ${res.status}`;
        const err = new NeuroEdgeGatewayError(message, {
          status: res.status,
          code: res.status === 429 ? "NEUROEDGE_RATE_LIMITED" : json?.code || "NEUROEDGE_HTTP_ERROR",
          details: {
            body: json || text,
            retryCount: attempt,
            upstreamStatus: res.status,
            retryAfterMs,
            retryAfterSeconds: toRetryAfterSeconds(retryAfterMs),
            retryable: isRetriableStatus(res.status),
          },
        });
        if (attempt < DEFAULT_RETRIES && isRetriableStatus(res.status)) {
          const delayMs = computeRetryDelayMs(attempt, retryAfterMs);
          err.details = {
            ...(err.details || {}),
            backoffMs: delayMs,
            nextRetryAttempt: attempt + 1,
          };
          await sleep(delayMs);
          attempt += 1;
          lastError = err;
          continue;
        }
        throw err;
      }
      return {
        payload: json || { ok: true },
        httpStatus: res.status,
        retryCount: attempt,
      };
    } catch (err) {
      clearTimeout(timeout);
      const isAbort = err?.name === "AbortError";
      const wrapped =
        err instanceof NeuroEdgeGatewayError
          ? err
          : new NeuroEdgeGatewayError(
              isAbort ? "NeuroEdge request timed out" : err?.message || "NeuroEdge request failed",
              {
                status: isAbort ? 504 : 502,
                code: isAbort ? "NEUROEDGE_TIMEOUT" : "NEUROEDGE_NETWORK_ERROR",
                details: { retryCount: attempt },
              }
            );
      if (attempt < DEFAULT_RETRIES) {
        const delayMs = computeRetryDelayMs(attempt, wrapped?.details?.retryAfterMs || 0);
        wrapped.details = {
          ...(wrapped.details || {}),
          backoffMs: delayMs,
          retryable: true,
          nextRetryAttempt: attempt + 1,
        };
        await sleep(delayMs);
        attempt += 1;
        lastError = wrapped;
        continue;
      }
      throw lastError || wrapped;
    }
  }
  throw lastError || new NeuroEdgeGatewayError("NeuroEdge request failed");
}

async function callOneBaseStream(
  baseUrl,
  path,
  { method = "POST", body, correlationId, idempotencyKey, onChunk } = {}
) {
  const url = `${baseUrl}${path}`;
  const headers = {
    "Content-Type": "application/json",
    Accept: "text/event-stream, application/x-ndjson, application/json, text/plain",
    ...getAuthHeaders(),
  };
  if (correlationId) headers["X-Correlation-Id"] = correlationId;
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  let attempt = 0;
  let lastError = null;
  while (attempt <= DEFAULT_RETRIES) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    let hasStreamedContent = false;
    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        clearTimeout(timeout);
        const text = await res.text();
        const json = parseTextAsJsonSafe(text);
        const retryAfterMs = parseRetryAfterMs(res.headers.get("retry-after"));
        const err = new NeuroEdgeGatewayError(
          res.status === 429
            ? buildRateLimitMessage(retryAfterMs)
            : json?.message || json?.error || `NeuroEdge request failed with status ${res.status}`,
          {
            status: res.status,
            code: res.status === 429 ? "NEUROEDGE_RATE_LIMITED" : json?.code || "NEUROEDGE_HTTP_ERROR",
            details: {
              body: json || text,
              retryCount: attempt,
              upstreamStatus: res.status,
              retryAfterMs,
              retryAfterSeconds: toRetryAfterSeconds(retryAfterMs),
              retryable: isRetriableStatus(res.status),
            },
          }
        );
        if (attempt < DEFAULT_RETRIES && isRetriableStatus(res.status)) {
          const delayMs = computeRetryDelayMs(attempt, retryAfterMs);
          err.details = {
            ...(err.details || {}),
            backoffMs: delayMs,
            nextRetryAttempt: attempt + 1,
          };
          await sleep(delayMs);
          attempt += 1;
          lastError = err;
          continue;
        }
        throw err;
      }

      const streamResult = await consumeReadableStream(res, {
        onChunk: (chunk, meta) => {
          hasStreamedContent = hasStreamedContent || Boolean(String(chunk || "").length);
          emitStreamChunk(onChunk, chunk, meta);
        },
      });
      clearTimeout(timeout);

      return {
        payload: streamResult.payload || { text: streamResult.text || "" },
        text: streamResult.text || "",
        httpStatus: res.status,
        retryCount: attempt,
        chunkCount: streamResult.chunkCount || 0,
      };
    } catch (err) {
      clearTimeout(timeout);
      const isAbort = err?.name === "AbortError";
      const wrapped =
        err instanceof NeuroEdgeGatewayError
          ? err
          : new NeuroEdgeGatewayError(
              isAbort ? "NeuroEdge streaming request timed out" : err?.message || "NeuroEdge streaming request failed",
              {
                status: isAbort ? 504 : 502,
                code: isAbort ? "NEUROEDGE_STREAM_TIMEOUT" : "NEUROEDGE_STREAM_ERROR",
                details: { retryCount: attempt },
              }
            );
      if (!hasStreamedContent && attempt < DEFAULT_RETRIES) {
        const delayMs = computeRetryDelayMs(attempt, wrapped?.details?.retryAfterMs || 0);
        wrapped.details = {
          ...(wrapped.details || {}),
          backoffMs: delayMs,
          retryable: true,
          nextRetryAttempt: attempt + 1,
        };
        await sleep(delayMs);
        attempt += 1;
        lastError = wrapped;
        continue;
      }
      throw lastError || wrapped;
    }
  }

  throw lastError || new NeuroEdgeGatewayError("NeuroEdge streaming request failed");
}

async function callNeuroEdge(path, { method = "POST", body, correlationId, idempotencyKey } = {}) {
  const baseUrls = getBaseUrls();
  if (!baseUrls.length) {
    throw new NeuroEdgeGatewayError("NeuroEdge base URL not configured", {
      status: 500,
      code: "NEUROEDGE_BASE_URL_MISSING",
    });
  }

  const errors = [];
  for (let i = 0; i < baseUrls.length; i += 1) {
    const base = baseUrls[i];
    if (isCircuitOpen(base)) {
      const circuitErr = buildCircuitOpenError(base);
      errors.push(`${base}:${circuitErr.code}`);
      if (i >= baseUrls.length - 1) {
        circuitErr.details = { ...(circuitErr.details || {}), failoverErrors: errors };
        throw circuitErr;
      }
      continue;
    }
    try {
      const out = await callOneBase(base, path, { method, body, correlationId, idempotencyKey });
      markSuccess(base);
      return {
        ...out.payload,
        meta: {
          ...(out.payload?.meta || {}),
          retryCount: out.retryCount,
          failoverUsed: i > 0,
          activeBaseUrl: base,
          httpStatus: out.httpStatus,
        },
      };
    } catch (err) {
      markFailure(base, err);
      errors.push(`${base}:${err?.code || err?.message || "ERROR"}`);
      if (i >= baseUrls.length - 1) {
        if (err instanceof NeuroEdgeGatewayError) {
          err.details = { ...(err.details || {}), failoverErrors: errors };
          throw err;
        }
        throw new NeuroEdgeGatewayError(err?.message || "NeuroEdge request failed", {
          status: 502,
          code: "NEUROEDGE_FAILOVER_EXHAUSTED",
          details: { failoverErrors: errors },
        });
      }
    }
  }
  throw new NeuroEdgeGatewayError("NeuroEdge request failed", {
    status: 502,
    code: "NEUROEDGE_FAILOVER_EXHAUSTED",
    details: { failoverErrors: errors },
  });
}

async function callNeuroEdgeStream(
  path,
  { method = "POST", body, correlationId, idempotencyKey, onChunk } = {}
) {
  const baseUrls = getBaseUrls();
  if (!baseUrls.length) {
    throw new NeuroEdgeGatewayError("NeuroEdge base URL not configured", {
      status: 500,
      code: "NEUROEDGE_BASE_URL_MISSING",
    });
  }

  const errors = [];
  for (let i = 0; i < baseUrls.length; i += 1) {
    const base = baseUrls[i];
    if (isCircuitOpen(base)) {
      const circuitErr = buildCircuitOpenError(base);
      errors.push(`${base}:${circuitErr.code}`);
      if (i >= baseUrls.length - 1) {
        circuitErr.details = { ...(circuitErr.details || {}), failoverErrors: errors };
        throw circuitErr;
      }
      continue;
    }
    try {
      const out = await callOneBaseStream(base, path, {
        method,
        body,
        correlationId,
        idempotencyKey,
        onChunk,
      });
      markSuccess(base);
      return {
        ...out.payload,
        text: out.text,
        meta: {
          ...(out.payload?.meta || {}),
          retryCount: out.retryCount,
          failoverUsed: i > 0,
          activeBaseUrl: base,
          httpStatus: out.httpStatus,
          chunkCount: out.chunkCount,
        },
      };
    } catch (err) {
      markFailure(base, err);
      errors.push(`${base}:${err?.code || err?.message || "ERROR"}`);
      if (i >= baseUrls.length - 1) {
        if (err instanceof NeuroEdgeGatewayError) {
          err.details = { ...(err.details || {}), failoverErrors: errors };
          throw err;
        }
        throw new NeuroEdgeGatewayError(err?.message || "NeuroEdge streaming request failed", {
          status: 502,
          code: "NEUROEDGE_FAILOVER_EXHAUSTED",
          details: { failoverErrors: errors },
        });
      }
    }
  }

  throw new NeuroEdgeGatewayError("NeuroEdge streaming request failed", {
    status: 502,
    code: "NEUROEDGE_FAILOVER_EXHAUSTED",
    details: { failoverErrors: errors },
  });
}

export const neuroedgeGatewayClient = {
  chatCompletions: (payload, ctx = {}) =>
    callNeuroEdge("/v1/chat/completions", { method: "POST", body: payload, ...ctx }),
  chatStream: (payload, ctx = {}) =>
    callNeuroEdgeStream("/v1/chat/stream", { method: "POST", body: payload, ...ctx }),
  feedback: (payload, ctx = {}) => callNeuroEdge("/v1/feedback", { method: "POST", body: payload, ...ctx }),
  extract: (payload, ctx = {}) => callNeuroEdge("/v1/extract", { method: "POST", body: payload, ...ctx }),
  ingestDocument: (payload, ctx = {}) =>
    callNeuroEdge("/v1/ingest/document", { method: "POST", body: payload, ...ctx }),
  search: (payload, ctx = {}) => callNeuroEdge("/v1/search", { method: "POST", body: payload, ...ctx }),
  fhirTransform: (payload, ctx = {}) =>
    callNeuroEdge("/v1/interop/fhir/transform", { method: "POST", body: payload, ...ctx }),
  hl7Transform: (payload, ctx = {}) =>
    callNeuroEdge("/v1/interop/hl7/transform", { method: "POST", body: payload, ...ctx }),
  authorize: (payload, ctx = {}) =>
    callNeuroEdge("/v1/guardrails/authorize", { method: "POST", body: payload, ...ctx }),
  staffingForecast: (payload, ctx = {}) =>
    callNeuroEdge("/v1/risk/staffing-forecast", { method: "POST", body: payload, ...ctx }),
  burnoutScore: (payload, ctx = {}) =>
    callNeuroEdge("/v1/risk/burnout-score", { method: "POST", body: payload, ...ctx }),
  causalImpact: (payload, ctx = {}) =>
    callNeuroEdge("/v1/risk/causal-impact", { method: "POST", body: payload, ...ctx }),
  digitalTwin: (payload, ctx = {}) =>
    callNeuroEdge("/v1/simulation/digital-twin", { method: "POST", body: payload, ...ctx }),
  getJob: (jobId, ctx = {}) =>
    callNeuroEdge(`/v1/jobs/${encodeURIComponent(String(jobId))}`, { method: "GET", ...ctx }),
  health: async (ctx = {}) => {
    try {
      return await callNeuroEdge("/health", { method: "GET", ...ctx });
    } catch (error) {
      const status = Number(error?.status || 0);
      const code = String(error?.code || "");
      if (
        status &&
        ![404, 405].includes(status) &&
        !["NEUROEDGE_HTTP_ERROR", "NEUROEDGE_FAILOVER_EXHAUSTED"].includes(code)
      ) {
        throw error;
      }

      const probe = await callNeuroEdge("/v1/chat/completions", {
        method: "POST",
        body: {
          ...(String(process.env.NEUROEDGE_CHAT_MODEL || "").trim()
            ? { model: String(process.env.NEUROEDGE_CHAT_MODEL || "").trim() }
            : {}),
          messages: [{ role: "user", content: "Reply with READY" }],
        },
        ...ctx,
      });

      return {
        ok: true,
        status: "OK",
        mode: "chat-completions-compat",
        probe: extractCompletionText(probe) || null,
        meta: probe?.meta || {},
      };
    }
  },
};
