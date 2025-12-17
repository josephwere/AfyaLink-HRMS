import React, { createContext, useContext, useEffect, useState } from "react";

/* ======================================================
   AUTH CONTEXT
====================================================== */

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  /* --------------------------------------------------
     Restore auth on refresh
  -------------------------------------------------- */
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const token = localStorage.getItem("token");

    if (storedUser && token) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.clear();
      }
    }

    setLoading(false);
  }, []);

  /* --------------------------------------------------
     LOGIN (expects API response)
  -------------------------------------------------- */
  const login = (userData, token) => {
    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.setItem("token", token);
  };

  /* --------------------------------------------------
     GUEST LOGIN (no backend)
  -------------------------------------------------- */
  const loginAsGuest = () => {
    setUser({
      role: "guest",
      name: "Demo User",
    });
  };

  /* --------------------------------------------------
     LOGOUT
  -------------------------------------------------- */
  const logout = () => {
    setUser(null);
    localStorage.clear();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        role: user?.role,
        login,
        loginAsGuest,
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

/* ======================================================
   API FETCH HELPER
====================================================== */
export async function apiFetch(path, options = {}) {
  const base = import.meta.env.VITE_API_URL || "";
  const token = localStorage.getItem("token");

  if (!token) {
    throw new Error("Guest users cannot access backend APIs");
  }

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`,
  };

  const res = await fetch(base + path, {
    ...options,
    headers,
    credentials: "include",
  });

  if (res.status === 401) {
    localStorage.clear();
    window.location.href = "/login";
  }

  return res;
}
