import { getPricingCatalogEntry } from "./pricingCatalogService.js";

function toNumber(value, fallback = 0) {
  const n = Number(value ?? fallback);
  return Number.isFinite(n) ? n : fallback;
}

function normalizePlan(plan) {
  if (!plan) return "DEFAULT";
  return String(plan).trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
}

function clampAmount(amount, minCharge, maxCharge) {
  let result = amount;
  if (Number.isFinite(minCharge) && minCharge > 0) {
    result = Math.max(result, minCharge);
  }
  if (Number.isFinite(maxCharge) && maxCharge > 0) {
    result = Math.min(result, maxCharge);
  }
  return result;
}

function applyFreeTier(quantity, freeTier) {
  const tier = toNumber(freeTier, 0);
  return Math.max(0, toNumber(quantity, 0) - tier);
}

function normalizeBillingQuantity(quantity, unit, pricingUnit) {
  const rawQuantity = toNumber(quantity, 0);
  const explicitUnit = String(unit || "").trim().toLowerCase();
  const catalogUnit = String(pricingUnit || "").trim().toLowerCase();
  const isTokenPack = catalogUnit.includes("1000") && catalogUnit.includes("token");
  if (!isTokenPack) return rawQuantity;
  if (!explicitUnit || explicitUnit === "unit" || explicitUnit === "tokens" || explicitUnit === "token") {
    return rawQuantity / 1000;
  }
  return rawQuantity;
}

function computeTieredAmount(quantity, tiers = []) {
  // tiers: [{ upTo: Number | null, unitPrice: Number }]
  let remaining = toNumber(quantity, 0);
  let total = 0;
  for (let i = 0; i < tiers.length && remaining > 0; i += 1) {
    const tier = tiers[i];
    const upTo = tier.upTo == null ? Infinity : Number(tier.upTo);
    const take = Math.min(remaining, upTo - (tiers[i - 1]?.upTo || 0));
    if (take > 0) {
      total += take * toNumber(tier.unitPrice, 0);
      remaining -= take;
    }
  }
  // If remaining and no open tier, apply last tier price if present
  if (remaining > 0 && tiers.length) {
    const last = tiers[tiers.length - 1];
    total += remaining * toNumber(last.unitPrice, 0);
  }
  return total;
}

export async function priceUsageEvent({ usageEvent, hospitalPlan = "DEFAULT", asOf = new Date() } = {}) {
  const plan = normalizePlan(hospitalPlan);
  const featureCode = usageEvent.featureCode || usageEvent.feature;
  const pricingEntry = await getPricingCatalogEntry({ featureCode, plan, asOf });
  if (!pricingEntry) {
    return { accepted: false, reason: "pricing_not_found", usageEvent, pricedUsage: null };
  }

  const mode = String(pricingEntry.billingMode || pricingEntry.billing_mode || "PER_REQUEST").toUpperCase();
  const freeTier = toNumber(pricingEntry.freeTier, 0);
  const rawQuantity = toNumber(usageEvent.quantity, 0);
  const normalizedQuantity = normalizeBillingQuantity(rawQuantity, usageEvent.unit, pricingEntry.unit);
  const chargeable = applyFreeTier(normalizedQuantity, freeTier);

  let amount = 0;
  let unitPrice = toNumber(pricingEntry.price, 0);
  let chargeableQuantity = chargeable;
  let discountApplied = 0;
  let freeUnitsApplied = freeTier;

  switch (mode) {
    case "PER_MINUTE":
    case "PER_PAGE":
    case "PER_MESSAGE":
    case "PER_GB":
    case "PER_TOKEN":
    case "PER_REQUEST":
      amount = chargeableQuantity * unitPrice;
      break;
    case "FLAT":
      amount = toNumber(pricingEntry.flatAmount, unitPrice);
      chargeableQuantity = 1;
      break;
    case "TIERED": {
      const tiers = Array.isArray(pricingEntry.tiers) ? pricingEntry.tiers : [];
      amount = computeTieredAmount(chargeableQuantity, tiers);
      // determine an approximate unitPrice for snapshot
      unitPrice = tiers && tiers.length ? toNumber(tiers[0].unitPrice, unitPrice) : unitPrice;
      break;
    }
    default:
      amount = chargeableQuantity * unitPrice;
  }

  amount = clampAmount(amount, pricingEntry.minCharge, pricingEntry.maxCharge);
  amount = Math.round(amount * 100) / 100;

  return {
    accepted: true,
    usageEvent,
    pricedUsage: {
      hospitalId: usageEvent.hospitalId,
      featureCode: pricingEntry.featureCode,
      feature: pricingEntry.featureCode,
      featureName: pricingEntry.displayName || pricingEntry.serviceName || pricingEntry.featureCode,
      serviceCode: pricingEntry.serviceCode || pricingEntry.featureCode,
      serviceName: pricingEntry.displayName || pricingEntry.serviceName || pricingEntry.featureCode,
      category: pricingEntry.category || "OTHER",
      quantity: rawQuantity,
      unit: pricingEntry.unit || usageEvent.unit || "unit",
      unitPrice,
      freeTier,
      chargeableQuantity,
      amount,
      currency: pricingEntry.currency || "KES",
      billingMode: mode,
      pricingVersion: pricingEntry.version || 1,
      catalogVersion: pricingEntry.version || 1,
      pricingEffectiveFrom: pricingEntry.effectiveFrom,
      plan,
      discountApplied,
      freeUnitsApplied,
      metadata: {
        ...usageEvent.metadata,
        pricingEntry: {
          featureCode: pricingEntry.featureCode,
          serviceCode: pricingEntry.serviceCode,
          effectiveFrom: pricingEntry.effectiveFrom,
          version: pricingEntry.version,
          plan,
        },
      },
    },
  };
}
