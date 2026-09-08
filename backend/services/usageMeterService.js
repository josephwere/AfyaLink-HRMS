import { buildUsageEvent } from "./usageCollectorService.js";
import { priceUsageEvent } from "./pricingEngineService.js";
import { createUsageLedgerEntry } from "./usageLedgerService.js";

export async function recordUsage({
  hospital,
  feature,
  quantity,
  unit = "unit",
  metadata = {},
  hospitalPlan,
  occurredAt = new Date(),
  persist = true,
} = {}) {
  const usageEvent = buildUsageEvent({ hospital, feature, quantity, unit, metadata, occurredAt });
  const plan = hospitalPlan || hospital?.plan || "DEFAULT";

  const pricingResult = await priceUsageEvent({ usageEvent, hospitalPlan: plan, asOf: occurredAt });
  if (!pricingResult.accepted) {
    return pricingResult;
  }

  const { pricedUsage } = pricingResult;
  const ledgerEntryPayload = {
    usageEvent,
    pricedUsage,
    status: "POSTED",
    metadata: pricingResult.usageEvent.metadata,
  };

  if (persist) {
    const ledgerEntry = await createUsageLedgerEntry(ledgerEntryPayload);
    return { accepted: true, usageEvent, pricedUsage, ledgerEntry };
  }

  const ledgerEntry = {
    ...ledgerEntryPayload,
    invoiceMonth: `${new Date(occurredAt).getFullYear()}-${String(new Date(occurredAt).getMonth() + 1).padStart(2, "0")}`,
    hospital: usageEvent.hospitalId,
    feature: pricedUsage.feature,
    serviceCode: pricedUsage.serviceCode,
    serviceName: pricedUsage.serviceName,
    category: pricedUsage.category,
    quantity: pricedUsage.quantity,
    unit: pricedUsage.unit,
    freeTier: pricedUsage.freeTier,
    chargeableQuantity: pricedUsage.chargeableQuantity,
    unitPrice: pricedUsage.unitPrice,
    amount: pricedUsage.amount,
    currency: pricedUsage.currency,
    billingMode: pricedUsage.billingMode,
    pricingVersion: pricedUsage.pricingVersion,
    pricingEffectiveFrom: pricedUsage.pricingEffectiveFrom,
    plan: pricedUsage.plan,
    occurredAt: usageEvent.occurredAt,
  };

  return { accepted: true, usageEvent, pricedUsage, ledgerEntry };
}
