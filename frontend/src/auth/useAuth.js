import { useEffect, useState, useCallback } from "react";
import apiFetch, { logout as apiLogout } from "../utils/apiFetch";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

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

  const login = async (emailOrToken, passwordOrOptions) => {
    if (passwordOrOptions?.directToken) {
      const { token, user } = passwordOrOptions;
      localStorage.setItem("token", token);
      if (passwordOrOptions.refreshToken) {
        localStorage.setItem("refreshToken", passwordOrOptions.refreshToken);
      }
      setUser(user);
      return { user };
    }

    try {
      const data = await apiFetch("/api/auth/login", {
        method: "POST",
        body: { email: emailOrToken, password: passwordOrOptions },
      });

      if (!data?.user) throw new Error("Invalid credentials");

      localStorage.setItem("token", data.accessToken);
      if (data.refreshToken) {
        localStorage.setItem("refreshToken", data.refreshToken);
      }
      setUser(data.user);

      if (data.requires2FA) return { requires2FA: true, userId: data.user.id };

      return { user: data.user };
    } catch (err) {
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    setUser(null);
    apiLogout();
  };

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
