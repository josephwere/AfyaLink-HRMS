import apiFetch from "../utils/apiFetch";

const MENU_CACHE_PREFIX = "afyalink_menu_cache_v1:";
const MENU_CACHE_TTL_MS = 10 * 60 * 1000;

export function makeMenuCacheKey({ userId, role, viewRole } = {}) {
  const safeUserId = userId ? String(userId) : "anon";
  const safeRole = role ? String(role) : "unknown";
  const safeViewRole = viewRole ? String(viewRole) : "";
  return `${MENU_CACHE_PREFIX}${safeUserId}:${safeRole}:${safeViewRole}`;
}

export function readMenuCache(cacheKey) {
  if (!cacheKey) return null;
  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const cachedAt = Number(parsed?.cachedAt || 0);
    if (!cachedAt || Date.now() - cachedAt > MENU_CACHE_TTL_MS) return null;
    const menu = Array.isArray(parsed?.menu) ? parsed.menu : null;
    return menu;
  } catch {
    return null;
  }
}

export function writeMenuCache(cacheKey, menu) {
  if (!cacheKey) return;
  try {
    localStorage.setItem(
      cacheKey,
      JSON.stringify({
        cachedAt: Date.now(),
        menu: Array.isArray(menu) ? menu : [],
      })
    );
  } catch {
    // ignore quota errors
  }
}

export const fetchMenu = async () => {
  return apiFetch("/api/menu");
};
