const cache = new Map();

export function createCacheEntry(value, { expires = null, version = null, subscribers = [] } = {}) {
  return {
    value,
    timestamp: Date.now(),
    expires,
    version,
    subscribers,
  };
}

export function getResourceCache(key) {
  const entry = cache.get(key);
  return entry ? entry.value : undefined;
}

export function getResourceCacheEntry(key) {
  return cache.get(key);
}

export function setResourceCache(key, value, meta = {}) {
  return cache.set(key, createCacheEntry(value, meta));
}

export function invalidateResourceCache(key) {
  cache.delete(key);
}

export function invalidateResourceCachePattern(pattern) {
  const matcher = new RegExp(pattern);
  for (const key of Array.from(cache.keys())) {
    if (matcher.test(key)) {
      cache.delete(key);
    }
  }
}

export function clearResourceCache() {
  cache.clear();
}

export default {
  createCacheEntry,
  getResourceCache,
  getResourceCacheEntry,
  setResourceCache,
  invalidateResourceCache,
  invalidateResourceCachePattern,
  clearResourceCache,
};
