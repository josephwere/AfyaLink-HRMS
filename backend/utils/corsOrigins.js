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
  return Array.from(
    new Set(
      [
        ...parseOriginList(process.env.CORS_ORIGIN),
        normalizeOrigin(process.env.FRONTEND_URL),
        normalizeOrigin(process.env.FRONTEND_PUBLIC_URL),
        "http://localhost:3000",
        "http://localhost:5173",
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
    if (["localhost", "127.0.0.1"].includes(parsed.hostname)) return true;
    if (parsed.hostname.endsWith(".vercel.app")) return true;
  } catch {
    return false;
  }

  return false;
}
