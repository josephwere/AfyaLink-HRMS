const isProd = process.env.NODE_ENV === "production";

function clean(value) {
  return String(value || "").trim();
}

function normalizeUrl(url) {
  const trimmed = clean(url);
  return trimmed ? trimmed.replace(/\/$/, "") : "";
}

function buildMissing(required = []) {
  return required.filter((key) => !clean(process.env[key] || ""));
}

export function getShaCredentials() {
  const baseUrl = normalizeUrl(process.env.SHA_BASE_URL);
  const preauthUrl = clean(process.env.SHA_PREAUTH_URL || (baseUrl ? `${baseUrl}/preauth` : ""));
  const tokenUrl = clean(process.env.SHA_TOKEN_URL || (baseUrl ? `${baseUrl}/oauth/token` : ""));
  const apiToken = clean(process.env.SHA_API_TOKEN);
  const clientId = clean(process.env.SHA_CLIENT_ID);
  const clientSecret = clean(process.env.SHA_CLIENT_SECRET);
  const audience = clean(process.env.SHA_AUDIENCE);
  const timeoutMs = Number(process.env.SHA_TIMEOUT_MS || 8000);

  const missing = [];
  if (!preauthUrl) missing.push("SHA_PREAUTH_URL");
  if (!apiToken && !(clientId && clientSecret && tokenUrl)) {
    if (!clientId) missing.push("SHA_CLIENT_ID");
    if (!clientSecret) missing.push("SHA_CLIENT_SECRET");
    if (!tokenUrl) missing.push("SHA_TOKEN_URL");
  }

  return {
    provider: "SHA",
    configured: missing.length === 0,
    missing,
    baseUrl: baseUrl || null,
    preauthUrl: preauthUrl || null,
    tokenUrl: tokenUrl || null,
    hasApiToken: Boolean(apiToken),
    audience: audience || null,
    timeoutMs,
    environment: isProd ? "production" : "non-prod",
  };
}

export function getEtimsCredentials() {
  const baseUrl = normalizeUrl(process.env.ETIMS_BASE_URL);
  const invoiceUrl = clean(process.env.ETIMS_INVOICE_URL || (baseUrl ? `${baseUrl}/invoices` : ""));
  const apiKey = clean(process.env.ETIMS_API_KEY);
  const apiToken = clean(process.env.ETIMS_API_TOKEN);
  const clientId = clean(process.env.ETIMS_CLIENT_ID);
  const clientSecret = clean(process.env.ETIMS_CLIENT_SECRET);
  const tokenUrl = clean(process.env.ETIMS_TOKEN_URL || (baseUrl ? `${baseUrl}/oauth/token` : ""));
  const timeoutMs = Number(process.env.ETIMS_TIMEOUT_MS || 8000);

  const missing = [];
  if (!invoiceUrl) missing.push("ETIMS_INVOICE_URL");
  if (!apiKey && !apiToken && !(clientId && clientSecret && tokenUrl)) {
    if (!apiKey) missing.push("ETIMS_API_KEY");
    if (!apiToken) missing.push("ETIMS_API_TOKEN");
    if (!clientId) missing.push("ETIMS_CLIENT_ID");
    if (!clientSecret) missing.push("ETIMS_CLIENT_SECRET");
    if (!tokenUrl) missing.push("ETIMS_TOKEN_URL");
  }

  return {
    provider: "ETIMS",
    configured: missing.length === 0,
    missing,
    baseUrl: baseUrl || null,
    invoiceUrl: invoiceUrl || null,
    tokenUrl: tokenUrl || null,
    hasApiKey: Boolean(apiKey),
    hasApiToken: Boolean(apiToken),
    timeoutMs,
    environment: isProd ? "production" : "non-prod",
  };
}

export function getMpesaCredentials() {
  const required = [
    "MPESA_CONSUMER_KEY",
    "MPESA_CONSUMER_SECRET",
    "MPESA_SHORTCODE",
    "MPESA_PASSKEY",
    "MPESA_CALLBACK_URL",
  ];

  const missing = buildMissing(required);
  const baseUrl = isProd ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";

  return {
    provider: "MPESA",
    configured: missing.length === 0,
    missing,
    baseUrl,
    environment: isProd ? "production" : "sandbox",
  };
}

export function ensureConfigured(config, { allowInNonProd = true } = {}) {
  if (config?.configured) return config;
  if (!allowInNonProd || isProd) {
    const missing = Array.isArray(config?.missing) ? config.missing.join(", ") : "";
    throw new Error(`${config?.provider || "Integration"} credentials missing${missing ? `: ${missing}` : ""}`);
  }
  return config;
}
