import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";

const SystemSettingsContext = createContext(null);

const PUBLIC_SETTINGS_CACHE_KEY = "afyalink_public_settings";
const BRANDING_CACHE_KEY = "afyalink_public_branding";
const SETTINGS_SYNC_KEY = "afyalink_system_settings_version";
const SETTINGS_CHANNEL = "afyalink-system-settings";
const PUBLIC_SETTINGS_BASE_KEY = "afyalink_public_settings_base";
const PRIVILEGED_ROLES = new Set(["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"]);

function isLocalHost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function joinUrl(base, path) {
  const safeBase = String(base || "").replace(/\/+$/, "");
  const safePath = String(path || "").startsWith("/") ? path : `/${path}`;
  return `${safeBase}${safePath}`;
}

function readStoredPublicSettingsBase() {
  try {
    return localStorage.getItem(PUBLIC_SETTINGS_BASE_KEY) || "";
  } catch {
    return "";
  }
}

function writeStoredPublicSettingsBase(base) {
  try {
    if (base) localStorage.setItem(PUBLIC_SETTINGS_BASE_KEY, base);
  } catch {
    // ignore storage issues
  }
}

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

function ensureImagePreload(url) {
  if (!url) return;
  const existing = document.head.querySelector(`link[data-afyalink-preload="${url}"]`);
  if (existing) return;
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "image";
  link.href = url;
  link.setAttribute("data-afyalink-preload", url);
  document.head.appendChild(link);
}

function preloadImage(url, { eager = false } = {}) {
  if (!url) return;
  if (eager) ensureImagePreload(url);
  const img = new Image();
  img.decoding = "async";
  img.loading = eager ? "eager" : "lazy";
  img.src = url;
}

function readCachedPublicSettings() {
  try {
    const cached = localStorage.getItem(PUBLIC_SETTINGS_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch {
    // ignore corrupted cache
  }

  try {
    const brandingCached = localStorage.getItem(BRANDING_CACHE_KEY);
    if (!brandingCached) return {};
    const branding = JSON.parse(brandingCached);
    return branding && typeof branding === "object" ? { branding } : {};
  } catch {
    return {};
  }
}

function normalizePublicSettings(data) {
  const branding = data?.branding && typeof data.branding === "object" ? data.branding : {};
  const ai = data?.ai && typeof data.ai === "object" ? data.ai : {};
  const monetization = data?.monetization && typeof data.monetization === "object" ? data.monetization : {};
  return {
    branding,
    ai: {
      enabled: ai.enabled !== false,
      icon: ai.icon || "",
      name: ai.name || "NeuroEdge",
      greeting: ai.greeting || "Hi, how can I help?",
      url: ai.url || "",
    },
    monetization: {
      ...(monetization || {}),
      featureAccess: {
        ...(monetization?.featureAccess || {}),
        ai: monetization?.featureAccess?.ai || "FREE",
      },
    },
    updatedAt: data?.updatedAt || null,
  };
}

function getStoredRole() {
  try {
    return String(JSON.parse(localStorage.getItem("user") || "{}")?.role || "").toUpperCase();
  } catch {
    return "";
  }
}

function broadcastSettingsUpdate() {
  try {
    localStorage.setItem(SETTINGS_SYNC_KEY, String(Date.now()));
  } catch {
    // ignore storage issues
  }
  if (typeof BroadcastChannel !== "undefined") {
    try {
      const channel = new BroadcastChannel(SETTINGS_CHANNEL);
      channel.postMessage({ type: "SETTINGS_UPDATED", at: Date.now() });
      channel.close();
    } catch {
      // ignore channel issues
    }
  }
}

export function SystemSettingsProvider({ children }) {
  const refreshInFlightRef = useRef(null);
  const [baseSettings, setBaseSettings] = useState(() => readCachedPublicSettings());
  const [hospitalCustomization, setHospitalCustomization] = useState(null);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [pushConnected, setPushConnected] = useState(false);
  const [syncSource, setSyncSource] = useState("bootstrap");
  const configuredBase = import.meta.env.VITE_API_URL || window.__ENV__?.API_URL || "";
  const runtimeOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const runtimeHost = typeof window !== "undefined" ? window.location.hostname : "";
  const isHostedFrontend = typeof window !== "undefined" && !isLocalHost(runtimeHost);

  const mergeSettings = (globalSettings, customization) => {
    const global = globalSettings || {};
    if (!customization?.enabled) return global;
    const next = { ...global };
    next.branding = {
      ...(global.branding || {}),
      ...(customization?.branding || {}),
      appName:
        customization?.branding?.appName ||
        global?.branding?.appName ||
        "AfyaLink",
    };
    next.hospitalCustomization = customization;
    return next;
  };

  const writePublicCache = useCallback((next) => {
    try {
      const normalized = normalizePublicSettings(next);
      localStorage.setItem(PUBLIC_SETTINGS_CACHE_KEY, JSON.stringify(normalized));
      localStorage.setItem(BRANDING_CACHE_KEY, JSON.stringify(normalized.branding || {}));
    } catch {
      // ignore cache write issues
    }
  }, []);

  const getPublicSettingsBases = useCallback(() => {
    const localBackend =
      typeof window !== "undefined" && isLocalHost(runtimeHost)
        ? `${window.location.protocol}//${runtimeHost}:5000`
        : "";
    const storedBase = readStoredPublicSettingsBase();
    const candidates = [];
    if (storedBase) candidates.push(storedBase);
    if (isHostedFrontend && runtimeOrigin) candidates.push(runtimeOrigin);
    if (configuredBase) candidates.push(configuredBase);
    if (!isHostedFrontend && localBackend) candidates.push(localBackend);
    if (runtimeOrigin) candidates.push(runtimeOrigin);
    return [...new Set(candidates.filter(Boolean))];
  }, [configuredBase, isHostedFrontend, runtimeHost, runtimeOrigin]);

  const fetchJsonWithTimeout = useCallback(async (url, options = {}, timeoutMs = 12000) => {
    const controller = new AbortController();
    const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal,
      });
    } finally {
      globalThis.clearTimeout(timeoutId);
    }
  }, []);

  const fetchPublicSettings = useCallback(async () => {
    let lastError = null;
    for (const candidateBase of getPublicSettingsBases()) {
      try {
        const response = await fetchJsonWithTimeout(joinUrl(candidateBase, "/api/system-settings/public"), {
          cache: "no-store",
          headers: {
            Accept: "application/json",
            "Cache-Control": "no-cache",
          },
        });
        const contentType = String(response.headers.get("content-type") || "");
        if (!response.ok || !contentType.includes("application/json")) {
          throw new Error("public branding unavailable");
        }
        const data = await response.json();
        const normalized = normalizePublicSettings(data);
        writePublicCache(normalized);
        writeStoredPublicSettingsBase(candidateBase);
        return normalized;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("public branding unavailable");
  }, [fetchJsonWithTimeout, getPublicSettingsBases, writePublicCache]);

  const fetchPrivateSettings = useCallback(async (token) => {
    const response = await fetch(joinUrl(configuredBase || runtimeOrigin, "/api/system-settings"), {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "Cache-Control": "no-cache",
      },
    });
    if (!response.ok) {
      throw new Error("private settings unavailable");
    }
    return response.json();
  }, [configuredBase, runtimeOrigin]);

  const fetchHospitalCustomization = useCallback(async (token, role) => {
    if (!token || role !== "HOSPITAL_ADMIN") {
      setHospitalCustomization(null);
      return null;
    }
    try {
      const response = await fetch(joinUrl(configuredBase || runtimeOrigin, "/api/hospital-admin/config"), {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "Cache-Control": "no-cache",
        },
      });
      if (!response.ok) {
        setHospitalCustomization(null);
        return null;
      }
      const data = await response.json();
      const customization = data?.customization || null;
      setHospitalCustomization(customization);
      return customization;
    } catch {
      setHospitalCustomization(null);
      return null;
    }
  }, [configuredBase, runtimeOrigin]);

  const refreshSettings = useCallback(async () => {
    if (refreshInFlightRef.current) return refreshInFlightRef.current;
    refreshInFlightRef.current = (async () => {
      const token = localStorage.getItem("token");
      const role = getStoredRole();
      let syncSucceeded = false;

      let publicSettings = null;
      try {
        publicSettings = await fetchPublicSettings();
        setBaseSettings(publicSettings);
        syncSucceeded = true;
      } catch {
        const cached = readCachedPublicSettings();
        setBaseSettings(cached);
        publicSettings = cached;
      }

      if (token && PRIVILEGED_ROLES.has(role)) {
        try {
          const privateSettings = await fetchPrivateSettings(token);
          setBaseSettings(privateSettings || publicSettings || {});
          syncSucceeded = true;
        } catch {
          setBaseSettings(publicSettings || {});
        }
      }

      await fetchHospitalCustomization(token, role);
      if (syncSucceeded) {
        setLastSyncedAt(new Date().toISOString());
      }
    })();
    try {
      return await refreshInFlightRef.current;
    } finally {
      refreshInFlightRef.current = null;
    }
  }, [fetchHospitalCustomization, fetchPrivateSettings, fetchPublicSettings]);

  useEffect(() => {
    refreshSettings();

    const onFocus = () => {
      refreshSettings().catch(() => {});
    };
    const onVisibility = () => {
      if (!document.hidden) refreshSettings().catch(() => {});
    };
    const onStorage = (event) => {
      if (event.key === SETTINGS_SYNC_KEY || event.key === PUBLIC_SETTINGS_CACHE_KEY) {
        refreshSettings().catch(() => {});
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("storage", onStorage);

    let channel = null;
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel(SETTINGS_CHANNEL);
      channel.onmessage = (event) => {
        if (event?.data?.type === "SETTINGS_UPDATED") {
          refreshSettings().catch(() => {});
        }
      };
    }

    const intervalId = window.setInterval(() => {
      refreshSettings().catch(() => {});
    }, 20000);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("storage", onStorage);
      window.clearInterval(intervalId);
      channel?.close?.();
    };
  }, [refreshSettings]);

  useEffect(() => {
    const socketUrl =
      import.meta.env.VITE_SOCKET_URL ||
      (isHostedFrontend ? runtimeOrigin : "") ||
      import.meta.env.VITE_API_URL ||
      window.location.origin;

    const token = localStorage.getItem("token");
    const socket = io(socketUrl, {
      transports: ["websocket"],
      autoConnect: true,
      auth: token ? { token } : {},
    });

    socket.on("connect", () => {
      setPushConnected(true);
    });

    socket.on("disconnect", () => {
      setPushConnected(false);
    });

    socket.on("system-settings:updated", () => {
      setSyncSource("push");
      refreshSettings().catch(() => {});
    });

    socket.on("connect_error", () => {
      setPushConnected(false);
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.off("system-settings:updated");
      socket.disconnect();
      setPushConnected(false);
    };
  }, [refreshSettings]);

  const settings = useMemo(
    () => mergeSettings(baseSettings, hospitalCustomization),
    [baseSettings, hospitalCustomization]
  );

  useEffect(() => {
    const branding = settings?.branding || {};
    const root = document.documentElement;

    if (branding.favicon) setFavicon(branding.favicon);
    if (branding.logo) root.style.setProperty("--brand-logo", `url(${branding.logo})`);
    else root.style.removeProperty("--brand-logo");

    if (branding.appIcon) root.style.setProperty("--brand-icon", `url(${branding.appIcon})`);
    else root.style.removeProperty("--brand-icon");

    if (branding.loginBackground) root.style.setProperty("--login-bg", `url(${branding.loginBackground})`);
    else root.style.removeProperty("--login-bg");

    if (branding.homeBackground) root.style.setProperty("--home-bg", `url(${branding.homeBackground})`);
    else root.style.removeProperty("--home-bg");

    const connection = navigator?.connection || navigator?.mozConnection || navigator?.webkitConnection;
    const saveData = Boolean(connection?.saveData);
    const slowNetwork = /2g/.test(String(connection?.effectiveType || ""));
    const canWarmHeavyAssets = !saveData && !slowNetwork;

    preloadImage(branding.logo, { eager: true });
    preloadImage(branding.appIcon, { eager: true });
    preloadImage(branding.loginBackground, { eager: true });
    if (canWarmHeavyAssets) {
      preloadImage(branding.homeBackground, { eager: false });
    }

    if (settings?.hospitalCustomization?.theme?.primaryColor) {
      root.style.setProperty("--primary", settings.hospitalCustomization.theme.primaryColor);
    }
    if (settings?.hospitalCustomization?.theme?.accentColor) {
      root.style.setProperty("--accent", settings.hospitalCustomization.theme.accentColor);
    }
  }, [settings]);

  const setSettings = useCallback((next) => {
    setBaseSettings(next || {});
    writePublicCache(next || {});
    setLastSyncedAt(new Date().toISOString());
    setSyncSource("local");
    broadcastSettingsUpdate();
  }, [writePublicCache]);

  const value = useMemo(
    () => ({
      settings,
      setSettings,
      refreshSettings,
      hospitalCustomization,
      lastSyncedAt,
      pushConnected,
      syncSource,
    }),
    [settings, setSettings, refreshSettings, hospitalCustomization, lastSyncedAt, pushConnected, syncSource]
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
