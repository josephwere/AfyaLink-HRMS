import { readStoredUser } from "./browserSession";

const REGION_CURRENCY = {
  AU: "AUD",
  BI: "BIF",
  BR: "BRL",
  CA: "CAD",
  CH: "CHF",
  CN: "CNY",
  DE: "EUR",
  DK: "DKK",
  ES: "EUR",
  FI: "EUR",
  FR: "EUR",
  GB: "GBP",
  IE: "EUR",
  IN: "INR",
  IT: "EUR",
  JP: "JPY",
  KE: "KES",
  NG: "NGN",
  NL: "EUR",
  NO: "NOK",
  PT: "EUR",
  RW: "RWF",
  SA: "SAR",
  SE: "SEK",
  SG: "SGD",
  TZ: "TZS",
  UG: "UGX",
  US: "USD",
  ZA: "ZAR",
};

function readPreferenceValue(user, key) {
  const fromUser = user?.uiPreferences?.[key];
  if (fromUser) return fromUser;
  return readStoredUser()?.uiPreferences?.[key];
}

function normalizeLocale(value) {
  const raw = String(value || "").trim();
  if (raw) return raw;
  if (typeof navigator !== "undefined" && navigator.language) {
    return navigator.language;
  }
  return "en-US";
}

function extractRegion(locale) {
  const match = normalizeLocale(locale).match(/[-_]([A-Za-z]{2})$/);
  return match ? match[1].toUpperCase() : "";
}

export function resolveUiLocale(user) {
  return normalizeLocale(
    readPreferenceValue(user, "locale") ||
      readPreferenceValue(user, "appLanguage") ||
      readPreferenceValue(user, "patientLanguage")
  );
}

export function resolveUiTimeZone(user) {
  const saved = String(readPreferenceValue(user, "timeZone") || "").trim();
  if (saved) return saved;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function resolveUiCurrency(user, fallback = "KES") {
  const saved = String(readPreferenceValue(user, "currency") || "").trim().toUpperCase();
  if (saved) return saved;
  const region = extractRegion(resolveUiLocale(user));
  return REGION_CURRENCY[region] || fallback;
}

export function getBrowserRegionDefaults() {
  const locale = resolveUiLocale();
  const appLanguage = String(locale).split(/[-_]/)[0] || "en";
  return {
    locale,
    appLanguage,
    patientLanguage: appLanguage,
    timeZone: resolveUiTimeZone(),
    currency: resolveUiCurrency(undefined, "KES"),
  };
}

export function formatDateTime(value, user, options = {}) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat(resolveUiLocale(user), {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: resolveUiTimeZone(user),
      ...options,
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

export function formatDateOnly(value, user, options = {}) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat(resolveUiLocale(user), {
      dateStyle: "medium",
      timeZone: resolveUiTimeZone(user),
      ...options,
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

export function formatNumber(value, user, options = {}) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return "0";
  try {
    return new Intl.NumberFormat(resolveUiLocale(user), options).format(numeric);
  } catch {
    return String(numeric);
  }
}

export function formatCurrency(value, currency = "", user, options = {}) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return `${currency || resolveUiCurrency(user)} 0`;

  const resolvedCurrency = String(currency || resolveUiCurrency(user)).trim().toUpperCase() || "KES";
  try {
    return new Intl.NumberFormat(resolveUiLocale(user), {
      style: "currency",
      currency: resolvedCurrency,
      maximumFractionDigits: 2,
      ...options,
    }).format(numeric);
  } catch {
    return `${resolvedCurrency} ${formatNumber(numeric, user)}`;
  }
}
