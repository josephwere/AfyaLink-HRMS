import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "../utils/auth";
import { canUseMyHealthContext, getDefaultContextMode, getContextModeLabel, isPatientContextUser } from "./userContextModel";

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
  const [mode, setModeState] = useState(() => getStoredMode() || getDefaultContextMode(user));

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isPatientContextUser(user)) {
      setModeState("MY_HEALTH");
      return;
    }
    const stored = getStoredUserContextMode();
    if (stored === "WORK" || stored === "MY_HEALTH") {
      setModeState(stored);
      return;
    }
    setModeState(getDefaultContextMode(user));
  }, [user]);

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
