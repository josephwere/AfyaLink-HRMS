import { createContext, useContext, useEffect, useMemo, useState } from "react";

const ThemeContext = createContext(null);

const THEMES = ["light", "dark"];

function normalizeTheme(theme) {
  return theme === "dark" ? "dark" : "light";
}

function applyTheme(theme) {
  const resolved = normalizeTheme(theme);
  document.documentElement.setAttribute("data-theme", resolved);
  document.documentElement.setAttribute("data-theme-mode", resolved);
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    return normalizeTheme(localStorage.getItem("theme") || "light");
  });

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem("theme", normalizeTheme(theme));
    return undefined;
  }, [theme]);

  const value = useMemo(
    () => ({
      theme: normalizeTheme(theme),
      setTheme: (nextTheme) => setTheme(normalizeTheme(nextTheme)),
      cycleTheme: () => {
        const idx = THEMES.indexOf(normalizeTheme(theme));
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
