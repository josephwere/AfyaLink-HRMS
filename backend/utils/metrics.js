const startedAt = Date.now();

const metricsState = {
  httpRequestsTotal: new Map(),
  httpRequestDurationMs: new Map(),
  httpRequestDurationBuckets: new Map(),
};

const LATENCY_BUCKETS_MS = [50, 100, 200, 400, 800, 1200, 2000, 5000];

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

  const histogram = metricsState.httpRequestDurationBuckets.get(latencyKey) || new Map();
  for (const upperBound of LATENCY_BUCKETS_MS) {
    if (durationMs <= upperBound) {
      histogram.set(String(upperBound), (histogram.get(String(upperBound)) || 0) + 1);
    }
  }
  histogram.set("+Inf", (histogram.get("+Inf") || 0) + 1);
  metricsState.httpRequestDurationBuckets.set(latencyKey, histogram);
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
  lines.push("# HELP afyalink_http_request_duration_ms_bucket Request latency histogram buckets in milliseconds");
  lines.push("# TYPE afyalink_http_request_duration_ms_bucket counter");
  for (const [key, value] of metricsState.httpRequestDurationMs.entries()) {
    const { method, route } = parseLatencyKey(key);
    const labels = `method="${escapeLabelValue(method)}",route="${escapeLabelValue(route)}"`;
    lines.push(`afyalink_http_request_duration_ms_count{${labels}} ${value.count}`);
    lines.push(`afyalink_http_request_duration_ms_sum{${labels}} ${value.sumMs}`);
    lines.push(`afyalink_http_request_duration_ms_max{${labels}} ${value.maxMs}`);

    const histogram = metricsState.httpRequestDurationBuckets.get(key) || new Map();
    const orderedBounds = [...LATENCY_BUCKETS_MS.map(String), "+Inf"];
    for (const bound of orderedBounds) {
      const count = histogram.get(bound) || 0;
      lines.push(
        `afyalink_http_request_duration_ms_bucket{${labels},le="${escapeLabelValue(bound)}"} ${count}`
      );
    }
  }

  lines.push("");
  return lines.join("\n");
}
