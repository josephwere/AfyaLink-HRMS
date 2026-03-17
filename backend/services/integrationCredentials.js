import { getSystemSettingsDoc } from "../utils/systemSettingsStore.js";

const isProd = process.env.NODE_ENV === "production";
const OVERRIDE_TTL_MS = 60000;
let overrideCache = null;
let overrideLoadedAt = 0;

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

function choose(overrideValue, envValue) {
  const override = clean(overrideValue);
  if (override) return override;
  return clean(envValue);
}

async function loadOverrides() {
  const now = Date.now();
  if (overrideCache && now - overrideLoadedAt < OVERRIDE_TTL_MS) return overrideCache;
  try {
    const doc = await getSystemSettingsDoc({ lean: true, createIfMissing: false });
    overrideCache = doc?.governmentApis || null;
    overrideLoadedAt = now;
  } catch {
    overrideCache = null;
    overrideLoadedAt = now;
  }
  return overrideCache;
}

export async function getShaCredentials() {
  const overrides = await loadOverrides();
  const sha = overrides?.sha || {};
  const baseUrl = normalizeUrl(choose(sha.baseUrl, process.env.SHA_BASE_URL));
  const preauthUrl = choose(sha.preauthUrl, process.env.SHA_PREAUTH_URL) || (baseUrl ? `${baseUrl}/preauth` : "");
  const tokenUrl = choose(sha.tokenUrl, process.env.SHA_TOKEN_URL) || (baseUrl ? `${baseUrl}/oauth/token` : "");
  const apiToken = choose(sha.apiToken, process.env.SHA_API_TOKEN);
  const clientId = choose(sha.clientId, process.env.SHA_CLIENT_ID);
  const clientSecret = choose(sha.clientSecret, process.env.SHA_CLIENT_SECRET);
  const audience = choose(sha.audience, process.env.SHA_AUDIENCE);
  const timeoutMs = Number(sha.timeoutMs || process.env.SHA_TIMEOUT_MS || 8000);

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
    apiToken: apiToken || null,
    clientId: clientId || null,
    clientSecret: clientSecret || null,
    audience: audience || null,
    timeoutMs,
    environment: isProd ? "production" : "non-prod",
  };
}

export async function getEtimsCredentials() {
  const overrides = await loadOverrides();
  const etims = overrides?.etims || {};
  const baseUrl = normalizeUrl(choose(etims.baseUrl, process.env.ETIMS_BASE_URL));
  const invoiceUrl = choose(etims.invoiceUrl, process.env.ETIMS_INVOICE_URL) || (baseUrl ? `${baseUrl}/invoices` : "");
  const apiKey = choose(etims.apiKey, process.env.ETIMS_API_KEY);
  const apiToken = choose(etims.apiToken, process.env.ETIMS_API_TOKEN);
  const clientId = choose(etims.clientId, process.env.ETIMS_CLIENT_ID);
  const clientSecret = choose(etims.clientSecret, process.env.ETIMS_CLIENT_SECRET);
  const tokenUrl = choose(etims.tokenUrl, process.env.ETIMS_TOKEN_URL) || (baseUrl ? `${baseUrl}/oauth/token` : "");
  const timeoutMs = Number(etims.timeoutMs || process.env.ETIMS_TIMEOUT_MS || 8000);

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
    apiKey: apiKey || null,
    apiToken: apiToken || null,
    clientId: clientId || null,
    clientSecret: clientSecret || null,
    timeoutMs,
    environment: isProd ? "production" : "non-prod",
  };
}

export async function getMpesaCredentials() {
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
