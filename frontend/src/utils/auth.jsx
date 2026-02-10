// frontend/src/utils/auth.jsx
import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { apiFetch, logout as apiLogout } from "./apiFetch";

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

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  /* --------------------------------------------------
     RESTORE SESSION (SAFE + EXP CHECK)
  -------------------------------------------------- */
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("user");
      const token = localStorage.getItem("token");

      if (!storedUser || !token) return;

      const decoded = parseJwt(token);
      if (!decoded?.role) throw new Error("Invalid token");

      // ⏱ Expired token → drop session
      if (decoded.exp && decoded.exp * 1000 < Date.now()) {
        throw new Error("Token expired");
      }

      setUser({
        ...JSON.parse(storedUser),
        role: decoded.role,
        twoFactorVerified: decoded?.twoFactor !== false,
      });
    } catch {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("2fa_pending");
      localStorage.removeItem("2fa_user");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  /* --------------------------------------------------
     LOGIN
  -------------------------------------------------- */
  const login = async (emailOrToken, passwordOrOptions) => {
    /* ============================
       🔑 GOOGLE / DIRECT TOKEN
    ============================ */
    if (
      typeof passwordOrOptions === "object" &&
      passwordOrOptions?.directToken === true
    ) {
      const accessToken = passwordOrOptions?.token || emailOrToken;
      if (!accessToken) {
        throw new Error("Missing access token");
      }
      const decoded = parseJwt(accessToken);

      if (!decoded?.role) {
        throw new Error("Invalid Google token");
      }

      const safeUser = {
        id: decoded.id,
        name: decoded.name,
        email: decoded.email,
        role: decoded.role,
      };

      localStorage.setItem("token", accessToken);
      localStorage.setItem("user", JSON.stringify(safeUser));

      setUser({
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
        email: emailOrToken,
        password: passwordOrOptions,
      },
    });

    /* 🔐 2FA REQUIRED */
    if (data.requires2FA) {
      localStorage.setItem("2fa_pending", "true");
      localStorage.setItem("2fa_user", data.userId);
      return { requires2FA: true, userId: data.userId };
    }

    if (!data.user?.role) {
      throw new Error("User role missing");
    }

    const safeUser = {
      id: data.user.id,
      name: data.user.name,
      email: data.user.email,
      role: data.user.role,
    };

    localStorage.setItem("token", data.accessToken);
    localStorage.setItem("user", JSON.stringify(safeUser));

    const decoded = parseJwt(data.accessToken);

    setUser({
      ...safeUser,
      twoFactorVerified: decoded?.twoFactor !== false,
    });

    return { user: safeUser };
  };

  /* --------------------------------------------------
     COMPLETE 2FA
  -------------------------------------------------- */
  const complete2FA = (accessToken) => {
    const decoded = parseJwt(accessToken);
    if (!decoded?.role) return;

    localStorage.setItem("token", accessToken);
    localStorage.removeItem("2fa_pending");
    localStorage.removeItem("2fa_user");

    const storedUser = JSON.parse(localStorage.getItem("user"));

    setUser({
      ...storedUser,
      role: decoded.role,
      twoFactorVerified: true,
    });
  };

  /* --------------------------------------------------
     LOGOUT
  -------------------------------------------------- */
  const logout = async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("2fa_pending");
      localStorage.removeItem("2fa_user");
      setUser(null);
      apiLogout();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: Boolean(user),
        role: user?.role,

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
