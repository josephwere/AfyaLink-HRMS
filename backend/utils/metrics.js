const startedAt = Date.now();

const metricsState = {
  httpRequestsTotal: new Map(),
  httpRequestDurationMs: new Map(),
};

function keyForStatus(method, route, status) {
  return `${method}|${route}|${status}`;
}

function keyForLatency(method, route) {
  return `${method}|${route}`;
}

function normalizeRoute(req) {
  if (req?.route?.path) return String(req.route.path);
  if (req?.baseUrl && req?.path) return `${req.baseUrl}${req.path}`;
  return req?.originalUrl?.split("?")[0] || req?.path || "unknown";
}

export function recordHttpRequest(req, statusCode, durationMs) {
  const method = String(req?.method || "GET").toUpperCase();
  const route = normalizeRoute(req);
  const status = String(statusCode || 0);

  const statusKey = keyForStatus(method, route, status);
  metricsState.httpRequestsTotal.set(
    statusKey,
    (metricsState.httpRequestsTotal.get(statusKey) || 0) + 1
  );

  const latencyKey = keyForLatency(method, route);
  const bucket = metricsState.httpRequestDurationMs.get(latencyKey) || {
    count: 0,
    sumMs: 0,
    maxMs: 0,
  };
  bucket.count += 1;
  bucket.sumMs += durationMs;
  bucket.maxMs = Math.max(bucket.maxMs, durationMs);
  metricsState.httpRequestDurationMs.set(latencyKey, bucket);
}

function escapeLabelValue(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function parseStatusKey(key) {
  const [method, route, status] = key.split("|");
  return { method, route, status };
}

function parseLatencyKey(key) {
  const [method, route] = key.split("|");
  return { method, route };
}

export function renderPrometheusMetrics() {
  const lines = [];
  const uptimeSec = Math.floor((Date.now() - startedAt) / 1000);

  lines.push("# HELP afyalink_uptime_seconds Process uptime in seconds");
  lines.push("# TYPE afyalink_uptime_seconds gauge");
  lines.push(`afyalink_uptime_seconds ${uptimeSec}`);

  lines.push("# HELP afyalink_http_requests_total Total HTTP requests by method/route/status");
  lines.push("# TYPE afyalink_http_requests_total counter");
  for (const [key, value] of metricsState.httpRequestsTotal.entries()) {
    const { method, route, status } = parseStatusKey(key);
    lines.push(
      `afyalink_http_requests_total{method="${escapeLabelValue(
        method
      )}",route="${escapeLabelValue(route)}",status="${escapeLabelValue(
        status
      )}"} ${value}`
    );
  }

  lines.push("# HELP afyalink_http_request_duration_ms_count Request latency sample count");
  lines.push("# TYPE afyalink_http_request_duration_ms_count counter");
  lines.push("# HELP afyalink_http_request_duration_ms_sum Request latency sum in milliseconds");
  lines.push("# TYPE afyalink_http_request_duration_ms_sum counter");
  lines.push("# HELP afyalink_http_request_duration_ms_max Request max latency in milliseconds");
  lines.push("# TYPE afyalink_http_request_duration_ms_max gauge");
  for (const [key, value] of metricsState.httpRequestDurationMs.entries()) {
    const { method, route } = parseLatencyKey(key);
    const labels = `method="${escapeLabelValue(method)}",route="${escapeLabelValue(route)}"`;
    lines.push(`afyalink_http_request_duration_ms_count{${labels}} ${value.count}`);
    lines.push(`afyalink_http_request_duration_ms_sum{${labels}} ${value.sumMs}`);
    lines.push(`afyalink_http_request_duration_ms_max{${labels}} ${value.maxMs}`);
  }

  lines.push("");
  return lines.join("\n");
}

