export const API_BASE =
  import.meta.env.VITE_API_URL ||
  window.__ENV__?.API_URL ||
  (() => {
    if (typeof window === "undefined") return "http://localhost:5000";
    const host = window.location.hostname;
    const origin = window.location.origin;
    const isLocal = host === "localhost" || host === "127.0.0.1";
    return isLocal ? `${window.location.protocol}//${host}:5000` : origin;
  })();
