function isLocalHostname(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export function resolveApiBase(configuredBase = "") {
  if (typeof window === "undefined") {
    return configuredBase || "http://localhost:5000";
  }

  const host = window.location.hostname;
  const origin = window.location.origin;
  const isLocal = isLocalHostname(host);
  const fallback = isLocal ? `${window.location.protocol}//${host}:5000` : origin;
  const rawBase = configuredBase || fallback;
  const url = new URL(rawBase, origin);
  const pathname = url.pathname.replace(/\/$/, "");
  return `${url.origin}${pathname}`;
}

export function assertSecureApiBase(base) {
  if (typeof window === "undefined") return;
  const url = new URL(base, window.location.origin);
  if (isLocalHostname(url.hostname)) return;
  if (url.protocol !== "https:") {
    throw new Error("Secure HTTPS connection required. Update the API URL to use HTTPS.");
  }
}
