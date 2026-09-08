import { FEATURE_CODES } from "../constants/featureCodes.js";
import { resolveFeatureCode } from "./featureRegistryService.js";

const defaultCatalog = [
  {
    featureCode: FEATURE_CODES.AI_CHAT,
    serviceCode: "AI_REQUEST",
    displayName: "AI Medical Assistant",
    category: "Artificial Intelligence",
    unit: "1000 Tokens",
    price: 25,
    currency: "KES",
    freeTier: 0,
    billingMode: "PER_REQUEST",
    minCharge: 0,
    maxCharge: Number.POSITIVE_INFINITY,
    active: true,
    version: 1,
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    planOverrides: {
      DEFAULT: { price: 25, freeTier: 0 },
      COMMUNITY: { price: 12, freeTier: 0 },
      COUNTY: { price: 15, freeTier: 0 },
      NATIONAL: { price: 8, freeTier: 0 },
    },
  },
  {
    featureCode: FEATURE_CODES.AI_DIAGNOSIS,
    serviceCode: "AI_REQUEST",
    displayName: "AI Diagnosis",
    category: "Artificial Intelligence",
    unit: "request",
    price: 15,
    currency: "KES",
    freeTier: 0,
    billingMode: "PER_REQUEST",
    minCharge: 0,
    maxCharge: Number.POSITIVE_INFINITY,
    active: true,
    version: 1,
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    planOverrides: {
      DEFAULT: { price: 15, freeTier: 0 },
      COMMUNITY: { price: 12, freeTier: 0 },
      COUNTY: { price: 15, freeTier: 0 },
      NATIONAL: { price: 8, freeTier: 0 },
    },
  },
  {
    featureCode: FEATURE_CODES.PATIENT_SMS,
    serviceCode: "COMMUNICATION_MESSAGE",
    displayName: "Patient SMS",
    category: "Communications",
    unit: "message",
    price: 2,
    currency: "KES",
    freeTier: 0,
    billingMode: "PER_MESSAGE",
    minCharge: 0,
    maxCharge: Number.POSITIVE_INFINITY,
    active: true,
    version: 1,
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    planOverrides: {
      DEFAULT: { price: 2, freeTier: 0 },
      COMMUNITY: { price: 1.8, freeTier: 0 },
      COUNTY: { price: 2, freeTier: 0 },
      NATIONAL: { price: 1.2, freeTier: 0 },
    },
  },
  {
    featureCode: FEATURE_CODES.VOICE_DICTATION,
    serviceCode: "VOICE_ANALYTICS",
    displayName: "Voice Dictation",
    category: "Voice",
    unit: "minute",
    price: 10,
    currency: "KES",
    freeTier: 0,
    billingMode: "PER_MINUTE",
    minCharge: 0,
    maxCharge: Number.POSITIVE_INFINITY,
    active: true,
    version: 1,
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    planOverrides: {
      DEFAULT: { price: 10, freeTier: 0 },
      COMMUNITY: { price: 10, freeTier: 0 },
      COUNTY: { price: 10, freeTier: 0 },
      NATIONAL: { price: 8, freeTier: 0 },
    },
  },
  {
    featureCode: FEATURE_CODES.OCR_DOCUMENT_SCAN,
    serviceCode: "DOCUMENT_OCR",
    displayName: "OCR Document",
    category: "Documents",
    unit: "page",
    price: 5,
    currency: "KES",
    freeTier: 0,
    billingMode: "PER_PAGE",
    minCharge: 0,
    maxCharge: Number.POSITIVE_INFINITY,
    active: true,
    version: 1,
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    planOverrides: {
      DEFAULT: { price: 5, freeTier: 0 },
      COMMUNITY: { price: 5, freeTier: 0 },
      COUNTY: { price: 5, freeTier: 0 },
      NATIONAL: { price: 4, freeTier: 0 },
    },
  },
  {
    featureCode: FEATURE_CODES.CLOUD_STORAGE_GB,
    serviceCode: "CLOUD_STORAGE",
    displayName: "Cloud Storage",
    category: "Storage",
    unit: "GB",
    price: 20,
    currency: "KES",
    freeTier: 0,
    billingMode: "PER_GB",
    minCharge: 0,
    maxCharge: Number.POSITIVE_INFINITY,
    active: true,
    version: 1,
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    planOverrides: {
      DEFAULT: { price: 20, freeTier: 0 },
      COMMUNITY: { price: 18, freeTier: 0 },
      COUNTY: { price: 20, freeTier: 0 },
      NATIONAL: { price: 12, freeTier: 0 },
    },
  },
];

function normalizePlan(plan) {
  if (!plan) return "DEFAULT";
  return String(plan).trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
}

function findBestMatch({ featureCode, plan, asOf }) {
  const entries = defaultCatalog.filter((entry) => entry.featureCode === featureCode && entry.active);
  if (!entries.length) return null;
  const effective = entries
    .filter((entry) => !entry.effectiveFrom || new Date(entry.effectiveFrom) <= new Date(asOf))
    .sort((a, b) => new Date(b.effectiveFrom) - new Date(a.effectiveFrom));
  return effective[0] || null;
}

export async function getPricingCatalogEntry({ feature, featureCode, plan = "DEFAULT", asOf = new Date() } = {}) {
  const normalizedPlan = normalizePlan(plan);
  const resolvedCode = resolveFeatureCode(featureCode || feature);
  if (!resolvedCode) return null;
  const canonical = findBestMatch({ featureCode: resolvedCode, plan: normalizedPlan, asOf });
  if (!canonical) return null;
  const override = canonical.planOverrides?.[normalizedPlan] || canonical.planOverrides?.DEFAULT || {};
  return {
    ...canonical,
    price: override.price ?? canonical.price,
    freeTier: override.freeTier ?? canonical.freeTier,
    plan: normalizedPlan,
  };
}

export async function listPricingCatalogEntries() {
  return defaultCatalog.map((entry) => ({ ...entry }));
}
