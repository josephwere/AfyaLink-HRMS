import { LEGACY_ROUTE_MAP } from "./legacyRouteMap";

/**
 * Convert legacy paths (ex: /super-admin/settings) into canonical /app/... routes.
 * Preserves query + hash when possible.
 */
export function canonicalizePath(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  if (raw.startsWith("/app/")) return raw;

  const [pathAndQuery, hash = ""] = raw.split("#");
  const [pathname, query = ""] = pathAndQuery.split("?");
  const mapped = LEGACY_ROUTE_MAP?.[pathname];
  if (!mapped) return raw;

  const rebuilt = query ? `${mapped}?${query}` : mapped;
  return hash ? `${rebuilt}#${hash}` : rebuilt;
}

