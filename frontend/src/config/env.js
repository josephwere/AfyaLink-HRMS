export const API_BASE =
  import.meta.env.VITE_API_URL ||
  window.__ENV__?.API_URL ||
  "http://localhost:5000";