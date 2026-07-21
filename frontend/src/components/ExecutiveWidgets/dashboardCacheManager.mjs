function createDashboardCacheManager(options = {}) {
  const { defaultTtlMs = 5 * 60 * 1000 } = options;
  const store = new Map();
  const subscribers = new Map();
  const diagnostics = {
    hits: 0,
    misses: 0,
    invalidations: 0,
    writes: 0,
    subscriptions: 0,
  };

  function get(key) {
    const entry = getEntry(key);
    if (!entry) {
      return null;
    }

    diagnostics.hits += 1;
    return entry.value;
  }

  function getEntry(key) {
    const entry = store.get(key);
    if (!entry) {
      diagnostics.misses += 1;
      return null;
    }

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      store.delete(key);
      diagnostics.misses += 1;
      return null;
    }

    return entry;
  }

  function set(key, value, ttlMs = defaultTtlMs) {
    const expiresAt = ttlMs != null ? Date.now() + ttlMs : null;
    store.set(key, { value, expiresAt, updatedAt: Date.now() });
    diagnostics.writes += 1;
    return value;
  }

  function invalidate(key) {
    if (store.delete(key)) {
      diagnostics.invalidations += 1;
    }
    return true;
  }

  function invalidateAll() {
    store.clear();
    diagnostics.invalidations += 1;
    return true;
  }

  function subscribe(key, listener) {
    const listeners = subscribers.get(key) ?? [];
    listeners.push(listener);
    subscribers.set(key, listeners);
    diagnostics.subscriptions += 1;

    return () => {
      const next = (subscribers.get(key) ?? []).filter((item) => item !== listener);
      if (next.length) {
        subscribers.set(key, next);
      } else {
        subscribers.delete(key);
      }
    };
  }

  function publish(key, value) {
    const listeners = subscribers.get(key) ?? [];
    listeners.forEach((listener) => listener(value));
  }

  function prefetch(key, loader, ttlMs = defaultTtlMs) {
    const cached = get(key);
    if (cached != null) {
      return Promise.resolve(cached);
    }

    return Promise.resolve(loader()).then((value) => {
      set(key, value, ttlMs);
      publish(key, value);
      return value;
    });
  }

  function gc() {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        store.delete(key);
      }
    }
  }

  function getDiagnostics() {
    return { ...diagnostics, size: store.size };
  }

  return {
    get,
    getEntry,
    set,
    invalidate,
    invalidateAll,
    subscribe,
    publish,
    prefetch,
    gc,
    getDiagnostics,
  };
}

export { createDashboardCacheManager };
export default createDashboardCacheManager;
