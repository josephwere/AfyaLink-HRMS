import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../utils/auth";
import { canUseMyHealthContext, getDefaultContextMode, getContextModeLabel, isPatientContextUser } from "./userContextModel";
import { resolveRequiredContext } from "./contextRouteRules";

const STORAGE_KEY = "afyalink_user_context_mode";

const UserContextContext = createContext(null);

function normalizeMode(value) {
  if (!value) return null;
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "my_health" || normalized === "my-health" || normalized === "patient") return "MY_HEALTH";
  if (normalized === "work" || normalized === "work_mode") return "WORK";
  return null;
}

export function getStoredUserContextMode() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizeMode(raw);
  } catch {
    return null;
  }
}

function getStoredMode() {
  return getStoredUserContextMode();
}

export function UserContextProvider({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  const [mode, setModeState] = useState(() => getStoredMode() || getDefaultContextMode(user));
  const prevUserIdRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!user) {
      prevUserIdRef.current = null;
      return;
    }

    // 1. Resolve context based on current URL path
    const required = resolveRequiredContext(location.pathname);
    if (required === "WORK" || required === "MY_HEALTH") {
      setModeState(required);
      prevUserIdRef.current = user.id;
      return;
    }

    // 2. Check for fresh user session login / restore
    if (prevUserIdRef.current !== user.id) {
      prevUserIdRef.current = user.id;
      const defaultMode = getDefaultContextMode(user);
      setModeState(defaultMode);
      try {
        window.localStorage.setItem(STORAGE_KEY, defaultMode);
      } catch {}
    }
  }, [user, location.pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Ignore storage failures.
    }
  }, [mode]);

  const setMode = useCallback((nextMode) => {
    setModeState(normalizeMode(nextMode) || getDefaultContextMode(user));
  }, [user]);

  const toggleMode = useCallback(() => {
    setModeState((current) => (current === "MY_HEALTH" ? "WORK" : "MY_HEALTH"));
  }, []);

  const value = useMemo(() => ({
    defaultMode: getDefaultContextMode(user),
    mode,
    isWorkMode: mode === "WORK",
    isMyHealthMode: mode === "MY_HEALTH",
    canUseMyHealthContext: canUseMyHealthContext(user),
    contextLabel: getContextModeLabel(mode),
    setMode,
    toggleMode,
    user,
  }), [mode, setMode, toggleMode, user]);

  return <UserContextContext.Provider value={value}>{children}</UserContextContext.Provider>;
}

export function useUserContext() {
  const context = useContext(UserContextContext);
  if (!context) {
    throw new Error("useUserContext must be used within a UserContextProvider");
  }
  return context;
}
