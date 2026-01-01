import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

/* ======================================================
   STORAGE KEYS
====================================================== */
const TOKEN_KEY = "accessToken";
const USER_KEY = "authUser";

/* ======================================================
   CONTEXT
====================================================== */
const AuthContext = createContext(null);

/* ======================================================
   PROVIDER
====================================================== */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading] = useState(true);

  /* ---------------------------------------
     Restore session on load
  ---------------------------------------- */
  useEffect(() => {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const storedUser = localStorage.getItem(USER_KEY);

      if (token && storedUser) {
        setAccessToken(token);
        setUser(JSON.parse(storedUser));
      }
    } catch (err) {
      console.error("Auth restore failed", err);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  /* ---------------------------------------
     Login with token (email, Google, refresh)
  ---------------------------------------- */
  const loginWithToken = useCallback((token, userData) => {
    if (!token || !userData) return;

    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));

    setAccessToken(token);
    setUser(userData);
  }, []);

  /* ---------------------------------------
     Update user safely (e.g. verify email)
  ---------------------------------------- */
  const updateUser = useCallback((updates) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...updates };
      localStorage.setItem(USER_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  /* ---------------------------------------
     Logout (hard reset)
  ---------------------------------------- */
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);

    setAccessToken(null);
    setUser(null);
  }, []);

  /* ---------------------------------------
     Role helpers (used by UI guards)
  ---------------------------------------- */
  const hasRole = useCallback(
    (...roles) => {
      if (!user?.role) return false;
      return roles.includes(user.role);
    },
    [user]
  );

  const isAdmin = hasRole("SUPER_ADMIN", "HOSPITAL_ADMIN");

  /* ---------------------------------------
     2FA helpers (non-breaking)
  ---------------------------------------- */
  const isTwoFactorRequired =
    user?.twoFactorEnabled && !user?.twoFactorVerified;

  /* ---------------------------------------
     Email verification helpers
  ---------------------------------------- */
  const isEmailVerified = Boolean(user?.emailVerified);

  /* ---------------------------------------
     Context value
  ---------------------------------------- */
  const value = {
    user,
    accessToken,
    loading,

    // auth actions
    loginWithToken,
    logout,
    updateUser,

    // helpers
    hasRole,
    isAdmin,
    isTwoFactorRequired,
    isEmailVerified,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

/* ======================================================
   HOOK
====================================================== */
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
};
