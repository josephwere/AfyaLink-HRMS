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
    circuitState.set(url, { consecutiveFailures: 0, openedAt: null });
  }
  return circuitState.get(url);
}

function isCircuitOpen(url) {
  const c = getCircuit(url);
  if (!c.openedAt) return false;
  if (Date.now() - c.openedAt >= DEFAULT_CIRCUIT_COOLDOWN_MS) {
    c.openedAt = null;
    c.consecutiveFailures = 0;
    return false;
  }
  return true;
}

function markSuccess(url) {
  const c = getCircuit(url);
  c.consecutiveFailures = 0;
  c.openedAt = null;
}

function markFailure(url) {
  const c = getCircuit(url);
  c.consecutiveFailures += 1;
  if (c.consecutiveFailures >= DEFAULT_CIRCUIT_THRESHOLD) {
    c.openedAt = Date.now();
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
        const message =
          json?.message ||
          json?.error ||
          `NeuroEdge request failed with status ${res.status}`;
        const err = new NeuroEdgeGatewayError(message, {
          status: res.status,
          code: json?.code || "NEUROEDGE_HTTP_ERROR",
          details: { body: json || text, retryCount: attempt, upstreamStatus: res.status },
        });
        if (attempt < DEFAULT_RETRIES && isRetriableStatus(res.status)) {
          await sleep(DEFAULT_RETRY_BACKOFF_MS * (attempt + 1));
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
        await sleep(DEFAULT_RETRY_BACKOFF_MS * (attempt + 1));
        attempt += 1;
        lastError = wrapped;
        continue;
      }
      throw lastError || wrapped;
    }
  }
  throw lastError || new NeuroEdgeGatewayError("NeuroEdge request failed");
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
      errors.push(`${base}:CIRCUIT_OPEN`);
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
      markFailure(base);
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

export const neuroedgeGatewayClient = {
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
  health: (ctx = {}) => callNeuroEdge("/healthz", { method: "GET", ...ctx }),
};
