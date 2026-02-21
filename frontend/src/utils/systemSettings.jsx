import { createContext, useContext, useEffect, useMemo, useState } from "react";

const SystemSettingsContext = createContext(null);

function setFavicon(href) {
  if (!href) return;
  let link = document.querySelector("link[rel='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = href;
}

export function SystemSettingsProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const base = import.meta.env.VITE_API_URL || "";

  useEffect(() => {
    fetch(`${base}/api/system-settings`)
      .then((r) => r.json())
      .then((data) => {
        setSettings(data);
      })
      .catch(() => setSettings({}));
  }, []);

  useEffect(() => {
    if (!settings) return;
    const branding = settings.branding || {};
    if (branding.favicon) {
      setFavicon(branding.favicon);
    }
    const root = document.documentElement;
    if (branding.logo) root.style.setProperty("--brand-logo", `url(${branding.logo})`);
    if (branding.appIcon) root.style.setProperty("--brand-icon", `url(${branding.appIcon})`);
    if (branding.loginBackground) root.style.setProperty("--login-bg", `url(${branding.loginBackground})`);
    if (branding.homeBackground) root.style.setProperty("--home-bg", `url(${branding.homeBackground})`);
  }, [settings]);

  const value = useMemo(
    () => ({
      settings,
      setSettings,
    }),
    [settings]
  );

  return (
    <SystemSettingsContext.Provider value={value}>
      {children}
    </SystemSettingsContext.Provider>
  );
}

export function useSystemSettings() {
  const ctx = useContext(SystemSettingsContext);
  if (!ctx) {
    throw new Error("useSystemSettings must be used inside SystemSettingsProvider");
  }
  return ctx;
}
