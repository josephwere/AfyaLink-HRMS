// frontend/src/auth/useAuth.js

import { useEffect, useState, useCallback } from "react";
import apiFetch, { logout as apiLogout } from "../utils/apiFetch";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  /* ======================================================
     FETCH CURRENT USER (BOOTSTRAP)
  ====================================================== */
  const fetchUser = useCallback(async () => {
    setLoading(true);
    try {
      const u = await apiFetch("/api/auth/me");
      setUser(u);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  /* ======================================================
     LOGIN FUNCTION
     Supports:
       1. Email + password
       2. Direct token login (Google)
  ====================================================== */
  const login = async (emailOrToken, passwordOrOptions) => {
    // Direct token login (Google)
    if (passwordOrOptions?.directToken) {
      const { token, user } = passwordOrOptions;
      localStorage.setItem("token", token);
      setUser(user);
      return { user };
    }

    // Email + password login
    try {
      const data = await apiFetch("/api/auth/login", {
        method: "POST",
        body: { email: emailOrToken, password: passwordOrOptions },
      });

      if (!data?.user) throw new Error("Invalid credentials");

      // Save token and update context
      localStorage.setItem("token", data.accessToken);
      setUser(data.user);

      // Handle 2FA
      if (data.requires2FA) {
        return { requires2FA: true, userId: data.user.id };
      }

      return { user: data.user };
    } catch (err) {
      throw err;
    }
  };

  /* ======================================================
     LOGOUT
  ====================================================== */
  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
    apiLogout();
  };

  /* ======================================================
     REFRESH USER (optional helper)
     Can be called after token refresh or Google login
  ====================================================== */
  const refreshUser = async () => {
    try {
      const u = await apiFetch("/api/auth/me");
      setUser(u);
      return u;
    } catch {
      setUser(null);
      return null;
    }
  };

  return { user, loading, login, logout, fetchUser, refreshUser };
}
