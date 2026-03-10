import fetch from "node-fetch";

const DEFAULT_BASE = "https://nominatim.openstreetmap.org";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map();

function cacheKey(query, limit) {
  return `${query.toLowerCase().trim()}::${limit}`;
}

function getCached(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() - item.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return item.value;
}

function setCached(key, value) {
  cache.set(key, { ts: Date.now(), value });
}

export async function geocodeSearch({ query, limit = 5 }) {
  if (process.env.DISABLE_GEO === "1") {
    return [];
  }
  const safeQuery = String(query || "").trim();
  if (!safeQuery || safeQuery.length < 3) return [];
  const safeLimit = Math.min(Math.max(Number(limit) || 5, 1), 10);
  const key = cacheKey(safeQuery, safeLimit);
  const cached = getCached(key);
  if (cached) return cached;

  const baseUrl = process.env.GEO_BASE_URL || DEFAULT_BASE;
  const contact = process.env.GEO_CONTACT_EMAIL || "support@afyalink.health";
  const url = new URL("/search", baseUrl);
  url.searchParams.set("q", safeQuery);
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", String(safeLimit));

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": `AfyaLink/1.0 (${contact})`,
      "Accept": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Geocode lookup failed (${res.status})`);
  }

  const data = await res.json();
  const result = Array.isArray(data)
    ? data.map((row) => ({
        name: row.display_name,
        lat: Number(row.lat),
        lng: Number(row.lon),
        raw: row,
      }))
    : [];

  setCached(key, result);
  return result;
}
