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

function preloadImage(url, { eager = false } = {}) {
  if (!url) return;
  const img = new Image();
  img.decoding = "async";
  img.loading = eager ? "eager" : "lazy";
  img.src = url;
}

function readCachedBranding() {
  try {
    const cached = localStorage.getItem("afyalink_public_branding");
    if (!cached) return {};
    const branding = JSON.parse(cached);
    return branding && typeof branding === "object" ? { branding } : {};
  } catch {
    return {};
  }
}

export function SystemSettingsProvider({ children }) {
  const [baseSettings, setBaseSettings] = useState(() => readCachedBranding());
  const [hospitalCustomization, setHospitalCustomization] = useState(null);
  const base = import.meta.env.VITE_API_URL || "";
  const BRANDING_CACHE_KEY = "afyalink_public_branding";

  const mergeSettings = (globalSettings, customization) => {
    if (!customization?.enabled) return globalSettings || {};
    const next = { ...(globalSettings || {}) };
    next.branding = {
      ...(globalSettings?.branding || {}),
      ...(customization?.branding || {}),
      appName:
        customization?.branding?.appName ||
        globalSettings?.branding?.appName ||
        "AfyaLink",
    };
    next.hospitalCustomization = customization;
    return next;
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    const fetchWithAuth = () =>
      fetch(`${base}/api/system-settings`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(async (r) => {
          if (!r.ok) return null;
          return r.json();
        })
        .then((data) => {
          if (data?.branding) {
            localStorage.setItem(BRANDING_CACHE_KEY, JSON.stringify(data.branding));
          }
          setBaseSettings(data || {});
        });

    const fetchPublic = () =>
      fetch(`${base}/api/system-settings/public`)
        .then(async (r) => {
          if (!r.ok) throw new Error("public branding unavailable");
          return r.json();
        })
        .then((data) => {
          const branding = data?.branding || {};
          localStorage.setItem(BRANDING_CACHE_KEY, JSON.stringify(branding));
          setBaseSettings({ branding });
        });

    if (token) {
      fetchWithAuth().catch(() => {
        const cached = localStorage.getItem(BRANDING_CACHE_KEY);
        if (cached) {
          try {
            setBaseSettings({ branding: JSON.parse(cached) });
            return;
          } catch {
            // ignore corrupted cache
          }
        }
        setBaseSettings({});
      });
      return;
    }

    fetchPublic().catch(() => {
      const cached = localStorage.getItem(BRANDING_CACHE_KEY);
      if (cached) {
        try {
          setBaseSettings({ branding: JSON.parse(cached) });
          return;
        } catch {
          // ignore corrupted cache
        }
      }
      setBaseSettings({});
    });
  }, [base]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const rawUser = localStorage.getItem("user");
    let role = "";
    try {
      role = JSON.parse(rawUser || "{}")?.role || "";
    } catch {
      role = "";
    }

    // Hospital customization endpoint is only valid for hospital-scoped roles.
    if (!token || role !== "HOSPITAL_ADMIN") {
      setHospitalCustomization(null);
      return;
    }

    fetch(`${base}/api/hospital-admin/config`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((data) => {
        const customization = data?.customization || null;
        setHospitalCustomization(customization);
      })
      .catch(() => setHospitalCustomization(null));
  }, [base]);

  const settings = useMemo(
    () => mergeSettings(baseSettings, hospitalCustomization),
    [baseSettings, hospitalCustomization]
  );

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
    const connection = navigator?.connection || navigator?.mozConnection || navigator?.webkitConnection;
    const saveData = Boolean(connection?.saveData);
    const slowNetwork = /2g/.test(String(connection?.effectiveType || ""));
    const canWarmHeavyAssets = !saveData && !slowNetwork;

    preloadImage(branding.logo, { eager: true });
    preloadImage(branding.appIcon, { eager: false });
    if (canWarmHeavyAssets) {
      const schedule = window.requestIdleCallback || ((cb) => setTimeout(cb, 500));
      schedule(() => {
        preloadImage(branding.loginBackground, { eager: false });
        preloadImage(branding.homeBackground, { eager: false });
      });
    }
    if (settings?.hospitalCustomization?.theme?.primaryColor) {
      root.style.setProperty("--primary", settings.hospitalCustomization.theme.primaryColor);
    }
    if (settings?.hospitalCustomization?.theme?.accentColor) {
      root.style.setProperty("--accent", settings.hospitalCustomization.theme.accentColor);
    }
  }, [settings]);

  const setSettings = (next) => {
    setBaseSettings(next);
  };

  const value = useMemo(
    () => ({
      settings,
      setSettings,
      hospitalCustomization,
    }),
    [settings, hospitalCustomization]
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
