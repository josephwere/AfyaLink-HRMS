function isLocalHostname(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function shouldPreferSameOriginProxy(configuredUrl, origin) {
  if (typeof window === "undefined") return false;
  if (!configuredUrl) return false;

  try {
    const target = new URL(configuredUrl, origin);
    if (isLocalHostname(target.hostname)) return false;
    return target.origin !== origin;
  } catch {
    return false;
  }
}

export function getRuntimeConfiguredApiBase() {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return (
      import.meta.env.VITE_API_BASE_URL ||
      import.meta.env.VITE_API_URL ||
      import.meta.env.NEXT_PUBLIC_API_BASE_URL ||
      ""
    );
  }

  if (typeof window !== "undefined") {
    return window.__ENV__?.API_BASE_URL || window.__ENV__?.API_URL || "";
  }

  return "";
}

export function resolveApiBase(configuredBase = "") {
  const preferredBase = configuredBase || getRuntimeConfiguredApiBase();
  if (typeof window === "undefined") {
    return preferredBase || "http://localhost:5000";
  }

  const host = window.location.hostname;
  const origin = window.location.origin;
  const isLocal = isLocalHostname(host);
  const fallback = isLocal ? `${window.location.protocol}//${host}:5000` : origin;
  const rawBase =
    !isLocal && shouldPreferSameOriginProxy(preferredBase, origin)
      ? origin
      : preferredBase || fallback;
  const url = new URL(rawBase, origin);
  const pathname = url.pathname.replace(/\/$/, "");
  return `${url.origin}${pathname}`;
}

export function resolveDirectApiBase(configuredBase = "") {
  const preferredBase = configuredBase || getRuntimeConfiguredApiBase();
  if (typeof window === "undefined") {
    return preferredBase || "http://localhost:5000";
  }

  if (preferredBase) {
    const url = new URL(preferredBase, window.location.origin);
    const pathname = url.pathname.replace(/\/$/, "");
    return `${url.origin}${pathname}`;
  }

  const host = window.location.hostname;
  if (isLocalHostname(host)) {
    return `${window.location.protocol}//${host}:5000`;
  }

  return "";
}

export function resolveApiUrl(path = "", configuredBase = "") {
  const base = resolveApiBase(configuredBase).replace(/\/$/, "");
  const normalizedPath = String(path || "").startsWith("/") ? String(path) : `/${String(path || "")}`;
  return `${base}${normalizedPath}`;
}

export function assertSecureApiBase(base) {
  if (typeof window === "undefined") return;
  const url = new URL(base, window.location.origin);
  if (isLocalHostname(url.hostname)) return;
  if (url.protocol !== "https:") {
    throw new Error("Secure HTTPS connection required. Update the API URL to use HTTPS.");
  }
}
