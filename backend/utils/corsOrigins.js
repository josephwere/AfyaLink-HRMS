function normalizeOrigin(origin = "") {
  return String(origin || "").trim().replace(/\/+$/, "");
}

function parseOriginList(value = "") {
  return String(value || "")
    .split(",")
    .map((entry) => normalizeOrigin(entry))
    .filter(Boolean);
}

export function getAllowedOrigins() {
  const isProduction = String(process.env.NODE_ENV || "").toLowerCase() === "production";
  return Array.from(
    new Set(
      [
        ...parseOriginList(process.env.CORS_ORIGIN),
        normalizeOrigin(process.env.FRONTEND_URL),
        normalizeOrigin(process.env.FRONTEND_PUBLIC_URL),
        ...(isProduction ? [] : ["http://localhost:3000", "http://localhost:5173"]),
      ].filter(Boolean)
    )
  );
}

export function isAllowedOrigin(origin) {
  const normalized = normalizeOrigin(origin);
  if (!normalized) return true;

  const allowlist = getAllowedOrigins();
  if (allowlist.includes(normalized)) return true;

  try {
    const parsed = new URL(normalized);
    if (!isProduction && ["localhost", "127.0.0.1"].includes(parsed.hostname)) return true;
    if (!isProduction && parsed.hostname.endsWith(".vercel.app")) return true;
  } catch {
    return false;
  }

  return false;
}
