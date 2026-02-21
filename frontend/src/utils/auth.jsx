// frontend/src/utils/auth.jsx
import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { apiFetch, logout as apiLogout } from "./apiFetch";
import { normalizeRole } from "./normalizeRole";

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

export function AuthProvider({ children }) {
  const [baseUser, setBaseUser] = useState(null);
  const [roleOverride, setRoleOverrideState] = useState(() => {
    return localStorage.getItem(ROLE_OVERRIDE_KEY) || "";
  });
  const [strictImpersonation, setStrictImpersonationState] = useState(() => {
    return localStorage.getItem(STRICT_IMPERSONATION_KEY) === "1";
  });
  const [loading, setLoading] = useState(true);
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

  /* --------------------------------------------------
     RESTORE SESSION (SAFE + EXP CHECK)
  -------------------------------------------------- */
  useEffect(() => {
    let mounted = true;
    const restore = async () => {
      try {
        const storedUser = localStorage.getItem("user");
        const token = localStorage.getItem("token");
        const refreshToken = localStorage.getItem("refreshToken");

        if (!token || !storedUser) {
          if (mounted) setBaseUser(null);
          return;
        }

        const decoded = parseJwt(token);
        const decodedRole = normalizeRole(decoded?.role);

        const isExpired = decoded?.exp && decoded.exp * 1000 < Date.now();
        if (!decodedRole || isExpired) {
          if (!refreshToken) throw new Error("Token expired");

          const res = await fetch(
            `${import.meta.env.VITE_API_URL}/api/auth/refresh`,
            {
              method: "POST",
              credentials: "include",
              headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ refreshToken }),
            }
          );

          if (!res.ok) throw new Error("Refresh failed");
          const data = await res.json();
          if (!data?.accessToken || !data?.user) throw new Error("Refresh failed");

          localStorage.setItem("token", data.accessToken);
          if (data.refreshToken) {
            localStorage.setItem("refreshToken", data.refreshToken);
          }
          localStorage.setItem("user", JSON.stringify(data.user));

          if (mounted) {
            setBaseUser({
              ...data.user,
              role: normalizeRole(data.user.role),
              twoFactorVerified: true,
            });
          }
          return;
        }

        if (mounted) {
          setBaseUser({
            ...JSON.parse(storedUser),
            role: decodedRole,
            twoFactorVerified: decoded?.twoFactor !== false,
          });
        }
      } catch {
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");
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
      const decoded = parseJwt(accessToken);

      const decodedRole = normalizeRole(decoded?.role);
      if (!decodedRole) {
        throw new Error("Invalid Google token");
      }

      const safeUser = {
        id: decoded.id,
        name: decoded.name,
        email: decoded.email,
        phone: decoded.phone,
        role: decodedRole,
      };

      localStorage.setItem("token", accessToken);
      if (passwordOrOptions?.refreshToken) {
        localStorage.setItem("refreshToken", passwordOrOptions.refreshToken);
      }
      localStorage.setItem("user", JSON.stringify(safeUser));

      setBaseUser({
        ...safeUser,
        twoFactorVerified: true,
      });

      return { user: safeUser };
    }

    /* ============================
       🔐 EMAIL / PASSWORD LOGIN
    ============================ */
    const data = await apiFetch("/api/auth/login", {
      method: "POST",
      body: {
        identifier: identifierOrToken,
        password: passwordOrOptions,
      },
    });

    /* 🔐 2FA REQUIRED */
    if (data.requires2FA) {
      localStorage.setItem("2fa_pending", "true");
      localStorage.setItem("2fa_user", data.userId);
      return { requires2FA: true, userId: data.userId };
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

    localStorage.setItem("token", data.accessToken);
    if (data.refreshToken) {
      localStorage.setItem("refreshToken", data.refreshToken);
    }
    localStorage.setItem("user", JSON.stringify(safeUser));

    const decoded = parseJwt(data.accessToken);

    setBaseUser({
      ...safeUser,
      twoFactorVerified: decoded?.twoFactor !== false,
    });

    return { user: safeUser };
  };

  /* --------------------------------------------------
     COMPLETE 2FA
  -------------------------------------------------- */
  const complete2FA = (accessToken, refreshToken) => {
    const decoded = parseJwt(accessToken);
    if (!decoded?.role) return;
    const decodedRole = normalizeRole(decoded.role);

    localStorage.setItem("token", accessToken);
    if (refreshToken) {
      localStorage.setItem("refreshToken", refreshToken);
    }
    localStorage.removeItem("2fa_pending");
    localStorage.removeItem("2fa_user");

    const storedUser = JSON.parse(localStorage.getItem("user"));

    setBaseUser({
      ...storedUser,
      role: decodedRole,
      twoFactorVerified: true,
    });
  };

  /* --------------------------------------------------
     LOGOUT
  -------------------------------------------------- */
  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem("refreshToken");
      await apiFetch("/api/auth/logout", {
        method: "POST",
        body: refreshToken ? { refreshToken } : {},
      });
    } catch {
      // ignore missing logout endpoint
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
      localStorage.removeItem("2fa_pending");
      localStorage.removeItem("2fa_user");
      localStorage.removeItem(ROLE_OVERRIDE_KEY);
      localStorage.removeItem(STRICT_IMPERSONATION_KEY);
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

  useEffect(() => {
    if (!canRoleOverride && roleOverride) {
      localStorage.removeItem(ROLE_OVERRIDE_KEY);
      setRoleOverrideState("");
    }
    if (!canRoleOverride && strictImpersonation) {
      localStorage.removeItem(STRICT_IMPERSONATION_KEY);
      setStrictImpersonationState(false);
    }
  }, [canRoleOverride, roleOverride, strictImpersonation]);

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
      {loading ? <div /> : children}
    </AuthContext.Provider>
  );
}

/* ======================================================
   HOOK
====================================================== */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
