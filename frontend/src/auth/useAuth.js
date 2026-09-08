import { useEffect, useState, useCallback } from "react";
import apiFetch, { logout as apiLogout } from "../utils/apiFetch";
import { clearBrowserSession, setAccessToken } from "../utils/browserSession";

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
    console.log('[debug] useAuth.login called for', emailOrToken);
    if (passwordOrOptions?.directToken) {
      const { token, user } = passwordOrOptions;
      setAccessToken(token);
      setUser(user);
      return { user };
    }

    try {
      console.log('[debug] useAuth.login: calling apiFetch /api/auth/login');
      const data = await apiFetch("/api/auth/login", {
        method: "POST",
        body: { email: emailOrToken, password: passwordOrOptions },
      });
      console.log('[debug] useAuth.login: apiFetch returned', data && { hasUser: !!data.user, requires2FA: data.requires2FA });

      if (!data?.user) throw new Error("Invalid credentials");

      setAccessToken(data.accessToken);
      setUser(data.user);

      if (data.requires2FA) return { requires2FA: true, userId: data.user.id };

      return { user: data.user };
    } catch (err) {
      throw err;
    }
  };

  const logout = () => {
    clearBrowserSession();
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
