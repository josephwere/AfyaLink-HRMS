import { createContext, useContext, useEffect, useMemo, useState } from "react";

const ThemeContext = createContext(null);

const THEMES = ["system", "light", "dark"];

function getSystemTheme() {
  if (typeof window === "undefined") return "light";
  return window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme) {
  const resolved = theme === "system" ? getSystemTheme() : theme;
  document.documentElement.setAttribute("data-theme", resolved);
  document.documentElement.setAttribute("data-theme-mode", theme);
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("theme") || "system";
  });

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem("theme", theme);

    if (theme !== "system") return undefined;

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    if (mq.addEventListener) {
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
    mq.addListener(handler);
    return () => mq.removeListener(handler);
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      cycleTheme: () => {
        const idx = THEMES.indexOf(theme);
        const next = THEMES[(idx + 1) % THEMES.length];
        setTheme(next);
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
