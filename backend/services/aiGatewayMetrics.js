const store = {
  total: 0,
  success: 0,
  failed: 0,
  guardrailDenied: 0,
  costUnits: 0,
  byEndpoint: {},
};

const MAX_SAMPLES = 1000;

function getEndpointBucket(endpoint) {
  if (!store.byEndpoint[endpoint]) {
    store.byEndpoint[endpoint] = {
      total: 0,
      success: 0,
      failed: 0,
      guardrailDenied: 0,
      retries: 0,
      costUnits: 0,
      latencySamples: [],
    };
  }
  return store.byEndpoint[endpoint];
}

function pushLatency(bucket, ms) {
  if (!Number.isFinite(ms)) return;
  bucket.latencySamples.push(ms);
  if (bucket.latencySamples.length > MAX_SAMPLES) {
    bucket.latencySamples.shift();
  }
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

export function recordGatewayMetric({
  endpoint,
  success = true,
  guardrailDenied = false,
  latencyMs = null,
  retryCount = 0,
  costUnits = 0,
}) {
  const bucket = getEndpointBucket(endpoint);
  store.total += 1;
  bucket.total += 1;
  if (success) {
    store.success += 1;
    bucket.success += 1;
  } else {
    store.failed += 1;
    bucket.failed += 1;
  }
  if (guardrailDenied) {
    store.guardrailDenied += 1;
    bucket.guardrailDenied += 1;
  }
  bucket.retries += Math.max(0, Number(retryCount || 0));
  bucket.costUnits += Math.max(0, Number(costUnits || 0));
  store.costUnits += Math.max(0, Number(costUnits || 0));
  pushLatency(bucket, Number(latencyMs));
}

export function getGatewayMetricsSnapshot() {
  const endpoints = {};
  Object.entries(store.byEndpoint).forEach(([endpoint, bucket]) => {
    endpoints[endpoint] = {
      total: bucket.total,
      success: bucket.success,
      failed: bucket.failed,
      guardrailDenied: bucket.guardrailDenied,
      retries: bucket.retries,
      costUnits: bucket.costUnits,
      latencyP95Ms: percentile(bucket.latencySamples, 95),
    };
  });
  return {
    total: store.total,
    success: store.success,
    failed: store.failed,
    guardrailDenied: store.guardrailDenied,
    costUnits: store.costUnits,
    endpoints,
  };
}
