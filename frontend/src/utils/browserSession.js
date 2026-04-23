const ACCESS_TOKEN_SESSION_KEY = "afyalink_access_token";
const USER_STORAGE_KEY = "user";

let accessTokenCache = "";

function canUseBrowserStorage() {
  return typeof window !== "undefined";
}

function readSessionToken() {
  if (!canUseBrowserStorage()) return "";
  try {
    return String(window.sessionStorage.getItem(ACCESS_TOKEN_SESSION_KEY) || "");
  } catch {
    return "";
  }
}

function writeSessionToken(value) {
  if (!canUseBrowserStorage()) return;
  try {
    if (value) {
      window.sessionStorage.setItem(ACCESS_TOKEN_SESSION_KEY, value);
    } else {
      window.sessionStorage.removeItem(ACCESS_TOKEN_SESSION_KEY);
    }
  } catch {
    // Ignore browser storage errors and keep the in-memory token.
  }
}

function migrateLegacyAccessToken() {
  if (!canUseBrowserStorage()) return;
  try {
    const existing = window.sessionStorage.getItem(ACCESS_TOKEN_SESSION_KEY);
    const legacy = window.localStorage.getItem("token");
    if (!existing && legacy) {
      window.sessionStorage.setItem(ACCESS_TOKEN_SESSION_KEY, legacy);
    }
    window.localStorage.removeItem("token");
    window.localStorage.removeItem("refreshToken");
  } catch {
    // Ignore migration failures and rely on runtime refresh.
  }
}

export function getAccessToken() {
  if (accessTokenCache) return accessTokenCache;
  accessTokenCache = readSessionToken();
  return accessTokenCache;
}

export function setAccessToken(token) {
  accessTokenCache = String(token || "");
  writeSessionToken(accessTokenCache);
  return accessTokenCache;
}

export function clearAccessToken() {
  accessTokenCache = "";
  writeSessionToken("");
}

export function readStoredUser() {
  if (!canUseBrowserStorage()) return null;
  try {
    const raw = window.localStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeStoredUser(user) {
  if (!canUseBrowserStorage()) return null;
  try {
    if (!user || typeof user !== "object") {
      window.localStorage.removeItem(USER_STORAGE_KEY);
      return null;
    }
    window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    return user;
  } catch {
    return null;
  }
}

export function clearStoredUser() {
  if (!canUseBrowserStorage()) return;
  try {
    window.localStorage.removeItem(USER_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function clearBrowserSession({ preserveUser = false } = {}) {
  clearAccessToken();
  if (!preserveUser) clearStoredUser();
  if (!canUseBrowserStorage()) return;
  try {
    window.localStorage.removeItem("refreshToken");
  } catch {
    // ignore
  }
}

migrateLegacyAccessToken();
accessTokenCache = readSessionToken();
