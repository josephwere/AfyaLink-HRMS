// frontend/src/utils/auth.jsx
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { apiFetch, logout as apiLogout } from "./apiFetch";
import {
  clearBrowserSession,
  getAccessToken,
  readStoredUser,
  setAccessToken,
  writeStoredUser,
} from "./browserSession";
import { normalizeRole } from "./normalizeRole";
import { flushOfflineRegistrations } from "./offlineRegistration";
import { guardedAuthFetch, warmAuthRuntime } from "../services/guardedAuthFetch";
import { assertSecureApiBase, getRuntimeConfiguredApiBase, resolveApiBase } from "./networkBase";
import { AUTH_EXPIRED_EVENT } from "../lib/api/client";
import { publishUserSignedIn, publishUserSignedOut } from "../ai/neuroedgeEventHelpers";

/* ======================================================
   JWT PARSER (BASE64URL SAFE)
====================================================== */
function parseJwt(token) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

/* ======================================================
   AUTH CONTEXT
====================================================== */
const AuthContext = createContext(null);
const ROLE_OVERRIDE_KEY = "role_override";
const STRICT_IMPERSONATION_KEY = "strict_impersonation";
const OFFLINE_LOGIN_KEY = "afyalink_offline_login_v1";
const AUTH_API_BASE = resolveApiBase(getRuntimeConfiguredApiBase());

async function postJsonWithTimeout(url, body = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function clearRoleOverrideState() {
  localStorage.removeItem(ROLE_OVERRIDE_KEY);
  localStorage.removeItem(STRICT_IMPERSONATION_KEY);
}

function normalizeIdentifier(value) {
  return String(value || "").trim().toLowerCase();
}

function readOfflineLoginStore() {
  try {
    const raw = localStorage.getItem(OFFLINE_LOGIN_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeOfflineLoginStore(store) {
  try {
    localStorage.setItem(OFFLINE_LOGIN_KEY, JSON.stringify(store || {}));
  } catch {
    // ignore quota errors
  }
}

function makeSalt() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256(value) {
  const data = new TextEncoder().encode(String(value || ""));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function rememberOfflineLoginCredential(user, identifier, password) {
  const normalizedIdentifier = normalizeIdentifier(identifier);
  if (!normalizedIdentifier || !password || typeof crypto?.subtle?.digest !== "function") return;
  const salt = makeSalt();
  const hash = await sha256(`${salt}::${normalizedIdentifier}::${password}`);
  const profile = {
    id: user?.id,
    name: user?.name,
    email: user?.email,
    phone: user?.phone,
    role: normalizeRole(user?.role),
    emailVerified: Boolean(user?.emailVerified),
    phoneVerified: Boolean(user?.phoneVerified),
    twoFactorVerified: true,
  };
  const store = readOfflineLoginStore();
  store[normalizedIdentifier] = {
    salt,
    hash,
    profile,
    updatedAt: new Date().toISOString(),
  };
  writeOfflineLoginStore(store);
}

async function tryOfflineLogin(identifier, password) {
  const normalizedIdentifier = normalizeIdentifier(identifier);
  if (!normalizedIdentifier || !password || typeof crypto?.subtle?.digest !== "function") {
    return null;
  }
  const store = readOfflineLoginStore();
  const record = store[normalizedIdentifier];
  if (!record?.salt || !record?.hash || !record?.profile) return null;
  const computed = await sha256(`${record.salt}::${normalizedIdentifier}::${password}`);
  if (computed !== record.hash) return null;
  return { ...record.profile, offlineSession: true };
}

export function AuthProvider({ children }) {
  const [baseUser, setBaseUser] = useState(null);
  const [roleOverride, setRoleOverrideState] = useState(() => {
    return localStorage.getItem(ROLE_OVERRIDE_KEY) || "";
  });
  const [strictImpersonation, setStrictImpersonationState] = useState(() => {
    return localStorage.getItem(STRICT_IMPERSONATION_KEY) === "1";
  });
  const [loading, setLoading] = useState(true);
  const refreshInFlightRef = useRef(false);
  const canRoleOverride =
    normalizeRole(baseUser?.role) === "SUPER_ADMIN" ||
    normalizeRole(baseUser?.role) === "DEVELOPER";
  const effectiveRole = canRoleOverride && roleOverride
    ? normalizeRole(roleOverride)
    : normalizeRole(baseUser?.role);
  const user = baseUser
    ? {
        ...baseUser,
        actualRole: normalizeRole(baseUser.role),
        role: effectiveRole,
      }
    : null;

  const refreshSession = async () => {
    if (refreshInFlightRef.current) return false;

    refreshInFlightRef.current = true;
    try {
      assertSecureApiBase(AUTH_API_BASE);
      const res = await postJsonWithTimeout(`${AUTH_API_BASE}/api/auth/refresh`, {}, 12000);
      if (!res.ok) return false;
      const data = await res.json();
      if (!data?.accessToken || !data?.user) return false;

      setAccessToken(data.accessToken);
      writeStoredUser(data.user);

      const decoded = parseJwt(data.accessToken);
      setBaseUser({
        ...data.user,
        role: normalizeRole(data.user.role),
        twoFactorVerified: decoded?.twoFactor !== false,
      });
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlightRef.current = false;
    }
  };

  const hydrateFromStoredSession = () => {
    const storedUser = readStoredUser();
    const token = getAccessToken();
    if (!token || !storedUser) {
      setBaseUser(null);
      return;
    }
    const decoded = parseJwt(token);
    const decodedRole = normalizeRole(decoded?.role);
    if (!decodedRole) {
      setBaseUser(null);
      return;
    }
    try {
      setBaseUser({
        ...storedUser,
        role: decodedRole,
        twoFactorVerified: decoded?.twoFactor !== false,
      });
    } catch {
      setBaseUser(null);
    }
  };

  /* --------------------------------------------------
     RESTORE SESSION (SAFE + EXP CHECK)
  -------------------------------------------------- */
  useEffect(() => {
    let mounted = true;
    const restore = async () => {
      try {
        const storedUser = readStoredUser();
        const token = getAccessToken();

        if (!token) {
          if (storedUser && navigator.onLine) {
            const refreshed = await refreshSession();
            if (refreshed) return;
          }
          if (mounted) setBaseUser(null);
          return;
        }

        const decoded = parseJwt(token);
        const decodedRole = normalizeRole(decoded?.role);

        const isExpired = decoded?.exp && decoded.exp * 1000 < Date.now();
        if (!decodedRole || isExpired) {
          if (!navigator.onLine && storedUser) {
            if (mounted) {
              setBaseUser({
                ...storedUser,
                role: normalizeRole(storedUser?.role || decodedRole),
                twoFactorVerified: true,
                offlineSession: true,
              });
            }
            return;
          }

          assertSecureApiBase(AUTH_API_BASE);
          const res = await postJsonWithTimeout(`${AUTH_API_BASE}/api/auth/refresh`, {}, 12000);

          if (!res.ok) throw new Error("Refresh failed");
          const data = await res.json();
          if (!data?.accessToken || !data?.user) throw new Error("Refresh failed");

          setAccessToken(data.accessToken);
          writeStoredUser(data.user);

          if (mounted) {
            setBaseUser({
              ...data.user,
              role: normalizeRole(data.user.role),
              twoFactorVerified: true,
            });
          }
          return;
        }

        if (!storedUser) {
          if (!navigator.onLine) {
            if (mounted) setBaseUser(null);
            return;
          }
          const refreshed = await refreshSession();
          if (!refreshed) throw new Error("Refresh failed");
          return;
        }

        if (mounted) {
          setBaseUser({
            ...storedUser,
            role: decodedRole,
            twoFactorVerified: decoded?.twoFactor !== false,
          });
        }
      } catch {
        clearBrowserSession();
        localStorage.removeItem("2fa_pending");
        localStorage.removeItem("2fa_user");
        localStorage.removeItem(ROLE_OVERRIDE_KEY);
        localStorage.removeItem(STRICT_IMPERSONATION_KEY);
        if (mounted) setBaseUser(null);
      }
    };

    restore().finally(() => {
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleAuthExpired = () => {
      clearBrowserSession();
      localStorage.removeItem("2fa_pending");
      localStorage.removeItem("2fa_user");
      localStorage.removeItem("2fa_method");
      localStorage.removeItem("2fa_reason");
      localStorage.removeItem("2fa_identifier");
      clearRoleOverrideState();
      setBaseUser(null);
      setLoading(false);
    };

    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const authEntryRoutes = new Set(["/login", "/register", "/forgot-password", "/2fa"]);
    if (authEntryRoutes.has(window.location.pathname)) {
      warmAuthRuntime("auth-entry").catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!baseUser) return undefined;

    const runKeepalive = async () => {
      const token = getAccessToken();
      if (!token) return;
      if (document.hidden) return;

      const decoded = parseJwt(token);
      const expiresInMs = (decoded?.exp || 0) * 1000 - Date.now();

      // Refresh only when token is close to expiry (~6 min) to avoid unnecessary calls.
      if (expiresInMs <= 6 * 60 * 1000) {
        await refreshSession();
      }
    };

    const onVisible = () => {
      if (!document.hidden) {
        runKeepalive();
      }
    };

    const onFocus = () => runKeepalive();

    const id = setInterval(runKeepalive, 60 * 1000);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [baseUser]);

  useEffect(() => {
    const watchKeys = new Set([
      "user",
      ROLE_OVERRIDE_KEY,
      STRICT_IMPERSONATION_KEY,
    ]);

    const onStorage = (event) => {
      if (event.storageArea !== localStorage) return;
      if (event.key && !watchKeys.has(event.key)) return;

      setRoleOverrideState(localStorage.getItem(ROLE_OVERRIDE_KEY) || "");
      setStrictImpersonationState(localStorage.getItem(STRICT_IMPERSONATION_KEY) === "1");
      const storedUser = readStoredUser();
      if (!storedUser) {
        setBaseUser(null);
        return;
      }
      if (getAccessToken()) {
        hydrateFromStoredSession();
        return;
      }
      if (!navigator.onLine) {
        setBaseUser(null);
        return;
      }
      refreshSession().catch(() => setBaseUser(null));
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    const sync = () => {
      flushOfflineRegistrations().catch(() => {});
    };
    sync();
    window.addEventListener("online", sync);
    return () => window.removeEventListener("online", sync);
  }, []);

  /* --------------------------------------------------
     LOGIN
  -------------------------------------------------- */
  const login = async (identifierOrToken, passwordOrOptions) => {
    /* ============================
       🔑 GOOGLE / DIRECT TOKEN
    ============================ */
    if (
      typeof passwordOrOptions === "object" &&
      passwordOrOptions?.directToken === true
    ) {
      const accessToken = passwordOrOptions?.token || identifierOrToken;
      if (!accessToken) {
        throw new Error("Missing access token");
      }

      const directUser = passwordOrOptions?.user || {};
      const decoded = parseJwt(accessToken);
      const decodedRole = normalizeRole(decoded?.role || directUser?.role);
      if (!decodedRole) {
        throw new Error("Invalid Google token");
      }

      const safeUser = {
        id: directUser?.id || decoded?.id,
        name: directUser?.name || decoded?.name,
        email: directUser?.email || decoded?.email,
        phone: directUser?.phone || decoded?.phone,
        role: decodedRole,
      };

      setAccessToken(accessToken);
      writeStoredUser(safeUser);
      clearRoleOverrideState();
      setRoleOverrideState("");
      setStrictImpersonationState(false);

      setLoading(false);
      setBaseUser({
        ...safeUser,
        twoFactorVerified: true,
      });

      return { user: safeUser };
    }

    /* ============================
       🔐 EMAIL / PASSWORD LOGIN
    ============================ */
    let data;
    try {
      data = await guardedAuthFetch("/api/auth/login", {
        method: "POST",
        body: {
          identifier: identifierOrToken,
          password: passwordOrOptions,
        },
      });
    } catch (err) {
      const networkLike =
        String(err?.message || "")
          .toLowerCase()
          .includes("network error") || !navigator.onLine;
      if (networkLike) {
        const offlineUser = await tryOfflineLogin(identifierOrToken, passwordOrOptions);
        if (offlineUser) {
          setLoading(false);
          setBaseUser({
            ...offlineUser,
            role: normalizeRole(offlineUser.role),
            twoFactorVerified: true,
            offlineSession: true,
          });
          return { user: offlineUser, offline: true };
        }
      }
      throw err;
    }

    /* 🔐 2FA REQUIRED */
    if (data.requires2FA) {
      localStorage.setItem("2fa_pending", "true");
      localStorage.setItem("2fa_user", data.userId);
      localStorage.setItem("2fa_method", data.method || "OTP");
      localStorage.setItem("2fa_reason", data.reason || "");
      localStorage.setItem("2fa_identifier", String(identifierOrToken || "").trim());
      if (data.user && typeof data.user === "object") {
        writeStoredUser(data.user);
      }
      return {
        requires2FA: true,
        userId: data.userId,
        method: data.method || "OTP",
        reason: data.reason || "",
      };
    }

    const normalizedRole = normalizeRole(data.user?.role);
    if (!normalizedRole) {
      throw new Error("User role missing");
    }

    const safeUser = {
      id: data.user.id,
      name: data.user.name,
      email: data.user.email,
      phone: data.user.phone,
      phoneVerified: data.user.phoneVerified,
      emailVerified: data.user.emailVerified,
      role: normalizedRole,
    };

    setAccessToken(data.accessToken);
    writeStoredUser(safeUser);
    clearRoleOverrideState();
    setRoleOverrideState("");
    setStrictImpersonationState(false);
    rememberOfflineLoginCredential(safeUser, identifierOrToken, passwordOrOptions).catch(() => {});

    const decoded = parseJwt(data.accessToken);

    setLoading(false);
    setBaseUser({
      ...safeUser,
      twoFactorVerified: decoded?.twoFactor !== false,
    });

    return { user: safeUser };
  };

  /* --------------------------------------------------
     COMPLETE 2FA
  -------------------------------------------------- */
  const complete2FA = (accessToken, refreshToken, resolvedUser = null) => {
    const decoded = parseJwt(accessToken);
    if (!decoded?.role) return;
    const decodedRole = normalizeRole(decoded.role);

    setAccessToken(accessToken);
    localStorage.removeItem("2fa_pending");
    localStorage.removeItem("2fa_user");
    localStorage.removeItem("2fa_method");
    localStorage.removeItem("2fa_reason");
    localStorage.removeItem("2fa_identifier");
    clearRoleOverrideState();
    setRoleOverrideState("");
    setStrictImpersonationState(false);

    const storedUser = resolvedUser || readStoredUser();
    if (storedUser) {
      writeStoredUser(storedUser);
    }

    setLoading(false);
    setBaseUser({
      ...(storedUser || {}),
      role: decodedRole,
      twoFactorVerified: true,
    });
  };

  /* --------------------------------------------------
     LOGOUT
  -------------------------------------------------- */
  const logout = async () => {
    try {
      await apiFetch("/api/auth/logout", {
        method: "POST",
        body: {},
      });
    } catch {
      // ignore missing logout endpoint
    } finally {
      clearBrowserSession();
      localStorage.removeItem("2fa_pending");
      localStorage.removeItem("2fa_user");
      localStorage.removeItem("2fa_method");
      localStorage.removeItem("2fa_reason");
      localStorage.removeItem("2fa_identifier");
      localStorage.removeItem(ROLE_OVERRIDE_KEY);
      localStorage.removeItem(STRICT_IMPERSONATION_KEY);
      // Clear sidebar preference on logout (ensures Option A: starts collapsed on next login)
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("afyalink_sidebar_preference_")) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
      setBaseUser(null);
      apiLogout();
    }
  };

  const setRoleOverride = (role) => {
    const normalized = normalizeRole(role);
    if (!canRoleOverride) return false;
    if (!normalized) {
      localStorage.removeItem(ROLE_OVERRIDE_KEY);
      setRoleOverrideState("");
      return true;
    }
    localStorage.setItem(ROLE_OVERRIDE_KEY, normalized);
    setRoleOverrideState(normalized);
    return true;
  };

  const setStrictImpersonation = (enabled) => {
    if (!canRoleOverride) return false;
    const next = Boolean(enabled);
    if (next) {
      localStorage.setItem(STRICT_IMPERSONATION_KEY, "1");
    } else {
      localStorage.removeItem(STRICT_IMPERSONATION_KEY);
    }
    setStrictImpersonationState(next);
    return true;
  };

  const patchUser = (patch = {}) => {
    if (!baseUser || !patch || typeof patch !== "object") return false;
    const nextUser = {
      ...baseUser,
      ...patch,
      uiPreferences: {
        ...(baseUser.uiPreferences || {}),
        ...(patch.uiPreferences || {}),
      },
    };
    setBaseUser(nextUser);
    try {
      writeStoredUser(nextUser);
    } catch {
      // ignore local storage sync errors
    }
    return true;
  };

  useEffect(() => {
    if (loading) return;
    if (baseUser) {
      publishUserSignedIn(baseUser);
    } else {
      publishUserSignedOut();
    }
  }, [baseUser, loading]);

  useEffect(() => {
    if (loading) return;
    if (!canRoleOverride && roleOverride) {
      localStorage.removeItem(ROLE_OVERRIDE_KEY);
      setRoleOverrideState("");
    }
    if (!canRoleOverride && strictImpersonation) {
      localStorage.removeItem(STRICT_IMPERSONATION_KEY);
      setStrictImpersonationState(false);
    }
  }, [canRoleOverride, roleOverride, strictImpersonation, loading]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: Boolean(user),
        role: user?.role,
        actualRole: user?.actualRole,
        roleOverride,
        strictImpersonation,
        canRoleOverride,
        setRoleOverride,
        setStrictImpersonation,
        patchUser,

        // existing
        login,
        complete2FA,
        logout,

        // helpers
        hasRole: (...roles) => roles.includes(user?.role),
        isAdmin: ["SUPER_ADMIN", "HOSPITAL_ADMIN"].includes(user?.role),
        is2FAVerified: Boolean(user?.twoFactorVerified),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/* ======================================================
   HOOK
====================================================== */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return {
      user: null,
      loading: false,
      isAuthenticated: false,
      role: null,
      actualRole: null,
      roleOverride: "",
      strictImpersonation: false,
      canRoleOverride: false,
      setRoleOverride: () => false,
      setStrictImpersonation: () => false,
      patchUser: () => false,
      login: async () => ({ user: null }),
      complete2FA: () => {},
      logout: async () => {},
      hasRole: () => false,
      isAdmin: false,
      is2FAVerified: false,
    };
  }
  return ctx;
}
