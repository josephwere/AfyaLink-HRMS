import { createContext, useContext, useEffect, useMemo, useState } from "react";
import apiFetch from "./apiFetch";
import {
  BROWSER_SESSION_USER_EVENT,
  readStoredUser,
  writeStoredUser,
} from "./browserSession";

const ThemeContext = createContext(null);

const THEMES = ["light", "dark"];
const THEME_STORAGE_KEY = "theme";

function normalizeTheme(theme) {
  return theme === "dark" ? "dark" : "light";
}

function getStoredThemePreference() {
  const storedUserTheme = readStoredUser()?.uiPreferences?.theme;
  if (storedUserTheme) return normalizeTheme(storedUserTheme);
  try {
    return normalizeTheme(localStorage.getItem(THEME_STORAGE_KEY) || "light");
  } catch {
    return "light";
  }
}

function applyTheme(theme) {
  const resolved = normalizeTheme(theme);
  document.documentElement.setAttribute("data-theme", resolved);
  document.documentElement.setAttribute("data-theme-mode", resolved);
}

async function persistThemePreference(theme) {
  const resolved = normalizeTheme(theme);
  const storedUser = readStoredUser();

  try {
    localStorage.setItem(THEME_STORAGE_KEY, resolved);
  } catch {
    // ignore local theme persistence failures
  }

  if (!storedUser || typeof storedUser !== "object") return;

  writeStoredUser({
    ...storedUser,
    uiPreferences: {
      ...(storedUser.uiPreferences || {}),
      theme: resolved,
    },
  });

  try {
    await apiFetch("/api/profile", {
      method: "PUT",
      body: {
        uiPreferences: {
          theme: resolved,
        },
      },
    });
  } catch {
    // Keep the local preference applied; the next authenticated save can retry.
  }
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    return getStoredThemePreference();
  });

  useEffect(() => {
    applyTheme(theme);
    return undefined;
  }, [theme]);

  useEffect(() => {
    const syncTheme = () => {
      setTheme(getStoredThemePreference());
    };

    const handleStorage = (event) => {
      if (event?.key && event.key !== THEME_STORAGE_KEY && event.key !== "user") return;
      syncTheme();
    };

    window.addEventListener(BROWSER_SESSION_USER_EVENT, syncTheme);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(BROWSER_SESSION_USER_EVENT, syncTheme);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const updateTheme = async (nextTheme) => {
    const resolved = normalizeTheme(nextTheme);
    setTheme(resolved);
    await persistThemePreference(resolved);
  };

  const value = useMemo(
    () => ({
      theme: normalizeTheme(theme),
      setTheme: updateTheme,
      cycleTheme: () => {
        const idx = THEMES.indexOf(normalizeTheme(theme));
        const next = THEMES[(idx + 1) % THEMES.length];
        void updateTheme(next);
      },
    }),
    [theme]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }
  return ctx;
}
