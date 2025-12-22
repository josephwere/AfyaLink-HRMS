import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { apiFetch, logout as apiLogout } from "./apiFetch";

/* ======================================================
   JWT PARSER
====================================================== */
function parseJwt(token) {
  try {
    const base64 = token.split(".")[1];
    return JSON.parse(atob(base64));
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
     Restore session (reload-safe + 2FA aware)
  -------------------------------------------------- */
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("user");
      const token = localStorage.getItem("token");

      if (storedUser && token) {
        const decoded = parseJwt(token);

        setUser({
          ...JSON.parse(storedUser),
          twoFactorVerified: decoded?.twoFactor !== false,
        });
      }
    } catch {
      localStorage.clear();
    } finally {
      setLoading(false);
    }
  }, []);

  /* --------------------------------------------------
     LOGIN (2FA AWARE)
  -------------------------------------------------- */
  const login = async (email, password) => {
    const res = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.msg || "Login failed");
    }

    /* 🔐 2FA REQUIRED */
    if (data.requires2FA) {
      localStorage.setItem("2fa_pending", "true");
      localStorage.setItem("2fa_user", data.userId);

      return {
        requires2FA: true,
        userId: data.userId,
      };
    }

    /* ✅ NORMAL LOGIN */
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
     COMPLETE 2FA (OTP VERIFIED)
  -------------------------------------------------- */
  const complete2FA = (accessToken) => {
    localStorage.setItem("token", accessToken);
    localStorage.removeItem("2fa_pending");
    localStorage.removeItem("2fa_user");

    const storedUser = localStorage.getItem("user");
    const decoded = parseJwt(accessToken);

    if (storedUser) {
      setUser({
        ...JSON.parse(storedUser),
        twoFactorVerified: decoded?.twoFactor !== false,
      });
    }
  };

  /* --------------------------------------------------
     LOGOUT
  -------------------------------------------------- */
  const logout = async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } finally {
      localStorage.clear();
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
        login,
        complete2FA,
        logout,
      }}
    >
      {!loading && children}
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
