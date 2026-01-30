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
    const token = localStorage.getItem("token");

    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

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
    /* ----------------------
       Google / direct token
    ----------------------- */
    if (passwordOrOptions?.directToken) {
      const { token, user } = passwordOrOptions;

      if (!token || !user) {
        throw new Error("Invalid authentication response");
      }

      localStorage.setItem("token", token);
      setUser(user);
      return { user };
    }

    /* ----------------------
       Email + password
    ----------------------- */
    try {
      const data = await apiFetch("/api/auth/login", {
        method: "POST",
        body: {
          email: emailOrToken,
          password: passwordOrOptions,
        },
      });

      if (!data?.user || !data?.accessToken) {
        throw new Error("Invalid credentials");
      }

      localStorage.setItem("token", data.accessToken);
      setUser(data.user);

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

  return {
    user,
    loading,
    login,
    logout,
    fetchUser,
    refreshUser,
  };
}
