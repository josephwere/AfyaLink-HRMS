const STORAGE_KEY = "afyalink_offline_actions_v1";
const METRICS_KEY = "afyalink_offline_metrics_v1";
const MAX_ITEMS = 2000;

const hasStorage = () =>
  typeof window !== "undefined" &&
  typeof window.localStorage !== "undefined";

const defaultMetrics = () => ({
  updatedAt: nowIso(),
  queueLength: 0,
  pendingByModule: {},
  lifetime: { enqueued: 0, synced: 0, failed: 0 },
  lastEnqueueAt: null,
  lastSyncAt: null,
  lastFailureAt: null,
  lastSyncResult: { synced: 0, pending: 0, failed: 0 },
});

let memoryQueue = [];
let memoryMetrics = null;

function nowIso() {
  return new Date().toISOString();
}

function readQueue() {
  try {
    if (!hasStorage()) {
      return Array.isArray(memoryQueue) ? memoryQueue : [];
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(items) {
  if (!hasStorage()) {
    memoryQueue = items.slice(-MAX_ITEMS);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(-MAX_ITEMS)));
}

function readMetrics() {
  try {
    if (!hasStorage()) {
      if (!memoryMetrics) memoryMetrics = defaultMetrics();
      return memoryMetrics;
    }
    const raw = localStorage.getItem(METRICS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    // ignore
  }
  return defaultMetrics();
}

function emitMetricsUpdated(metrics) {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") return;
  window.dispatchEvent(
    new CustomEvent("afyalink:offline-metrics-updated", {
      detail: metrics,
    })
  );
}

function countPendingByModule(queue) {
  const out = {};
  for (const item of queue) {
    const key = String(item.feature || "GLOBAL").toUpperCase();
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}

function writeMetrics(metrics, options = {}) {
  const { emit = true } = options;
  if (!hasStorage()) {
    memoryMetrics = metrics;
  } else {
    localStorage.setItem(METRICS_KEY, JSON.stringify(metrics));
  }
  if (emit) emitMetricsUpdated(metrics);
}

function refreshMetricsFromQueue(partial = {}, options = {}) {
  const { emit = true } = options;
  const queue = readQueue();
  const prev = readMetrics();
  const metrics = {
    ...prev,
    ...partial,
    updatedAt: nowIso(),
    queueLength: queue.length,
    pendingByModule: countPendingByModule(queue),
    lifetime: {
      enqueued: Number(prev?.lifetime?.enqueued || 0),
      synced: Number(prev?.lifetime?.synced || 0),
      failed: Number(prev?.lifetime?.failed || 0),
      ...(partial.lifetime || {}),
    },
  };
  writeMetrics(metrics, { emit });
  return metrics;
}

export function listOfflineActions() {
  return readQueue();
}

export function getOfflineMetricsSnapshot() {
  return readMetrics();
}

export function refreshOfflineMetricsSnapshot(options = {}) {
  return refreshMetricsFromQueue({}, options);
}

export function enqueueOfflineAction(action) {
  const queue = readQueue();
  const item = {
    id: `off_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: nowIso(),
    retries: 0,
    ...action,
  };
  queue.push(item);
  writeQueue(queue);
  const prev = readMetrics();
  refreshMetricsFromQueue({
    lastEnqueueAt: nowIso(),
    lifetime: {
      enqueued: Number(prev?.lifetime?.enqueued || 0) + 1,
      synced: Number(prev?.lifetime?.synced || 0),
      failed: Number(prev?.lifetime?.failed || 0),
    },
  });
  return item;
}

export function removeOfflineAction(id) {
  const queue = readQueue().filter((q) => q.id !== id);
  writeQueue(queue);
  refreshMetricsFromQueue();
}

export function clearOfflineActions() {
  localStorage.removeItem(STORAGE_KEY);
  refreshMetricsFromQueue();
}

export async function flushOfflineActions(executor, options = {}) {
  const maxRetries = options.maxRetries ?? 5;
  const queue = readQueue();
  const remaining = [];
  let synced = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      await executor(item);
      synced += 1;
    } catch {
      failed += 1;
      const retries = Number(item.retries || 0) + 1;
      if (retries <= maxRetries) {
        remaining.push({ ...item, retries, lastTriedAt: nowIso() });
      }
    }
  }

  writeQueue(remaining);
  const prev = readMetrics();
  const metrics = refreshMetricsFromQueue({
    lastSyncAt: nowIso(),
    lastFailureAt: failed > 0 ? nowIso() : prev?.lastFailureAt || null,
    lastSyncResult: { synced, pending: remaining.length, failed },
    lifetime: {
      enqueued: Number(prev?.lifetime?.enqueued || 0),
      synced: Number(prev?.lifetime?.synced || 0) + synced,
      failed: Number(prev?.lifetime?.failed || 0) + failed,
    },
  });

  return { synced, pending: remaining.length, failed, metrics };
}

export function startOfflineAutoSync(executor, opts = {}) {
  const onOnline = () => {
    flushOfflineActions(executor, opts)
      .then((result) => {
        if (typeof opts.onMetrics === "function") {
          opts.onMetrics(result?.metrics || refreshOfflineMetricsSnapshot(), result);
        }
      })
      .catch(() => {});
  };
  window.addEventListener("online", onOnline);
  refreshMetricsFromQueue();
  onOnline();
  return () => window.removeEventListener("online", onOnline);
}
