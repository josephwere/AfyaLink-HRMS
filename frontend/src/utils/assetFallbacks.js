const BROKEN_ASSET_CACHE_KEY = "afyalink_broken_assets_v1";

function readBrokenAssetCache() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(BROKEN_ASSET_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map((item) => String(item || "").trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function writeBrokenAssetCache(entries = []) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BROKEN_ASSET_CACHE_KEY, JSON.stringify(entries.slice(-50)));
  } catch {
    // ignore storage failures
  }
}

export function isKnownBrokenAsset(url = "") {
  const source = String(url || "").trim();
  if (!source) return false;
  return readBrokenAssetCache().includes(source);
}

export function markAssetBroken(url = "") {
  const source = String(url || "").trim();
  if (!source || typeof window === "undefined") return;
  const next = [...new Set([...readBrokenAssetCache(), source])];
  writeBrokenAssetCache(next);
}

export function getPreferredAssetSource(url = "", fallback = "") {
  const source = String(url || "").trim();
  if (source && !isKnownBrokenAsset(source)) return source;
  return String(fallback || "").trim();
}
