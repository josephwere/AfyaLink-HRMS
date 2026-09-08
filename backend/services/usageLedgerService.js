import UsageLedgerEntry from "../models/UsageLedgerEntry.js";
import eventPublisher from "./eventPublisher.js";

function formatInvoiceMonth(date) {
  const occurredAt = date ? new Date(date) : new Date();
  return `${occurredAt.getFullYear()}-${String(occurredAt.getMonth() + 1).padStart(2, "0")}`;
}

export function buildUsageLedgerEntry({ usageEvent, pricedUsage, status = "PENDING", metadata = {} } = {}) {
  const occurredAt = usageEvent.occurredAt ? new Date(usageEvent.occurredAt) : new Date();
  const resolvedFeatureCode = usageEvent.featureCode || pricedUsage.featureCode || usageEvent.feature;
  return {
    // Tracing
    eventId: usageEvent.eventId || usageEvent.metadata?.eventId || null,
    requestId: usageEvent.requestId || usageEvent.metadata?.requestId || null,
    userId: usageEvent.userId || usageEvent.metadata?.userId || null,
    patientId: usageEvent.patientId || usageEvent.metadata?.patientId || null,

    hospital: usageEvent.hospitalId,
    feature: resolvedFeatureCode,
    featureCode: resolvedFeatureCode,
    featureName: pricedUsage.featureName || usageEvent.featureName || "Unknown Premium Service",
    serviceCode: pricedUsage.serviceCode || resolvedFeatureCode,
    serviceName: pricedUsage.serviceName || usageEvent.featureName || resolvedFeatureCode,
    category: pricedUsage.category || "OTHER",
    quantity: pricedUsage.quantity,
    unit: pricedUsage.unit,
    freeTier: pricedUsage.freeTier,
    chargeableQuantity: pricedUsage.chargeableQuantity,

    // Pricing snapshot
    catalogVersion: pricedUsage.pricingVersion || pricedUsage.catalogVersion || 1,
    unitPrice: pricedUsage.unitPrice,
    discountApplied: pricedUsage.discountApplied || 0,
    freeUnitsApplied: pricedUsage.freeUnitsApplied || 0,
    amount: pricedUsage.amount,
    currency: pricedUsage.currency,
    billingMode: pricedUsage.billingMode,
    pricingVersion: pricedUsage.pricingVersion,
    pricingEffectiveFrom: pricedUsage.pricingEffectiveFrom,

    plan: pricedUsage.plan,
    invoiceMonth: formatInvoiceMonth(occurredAt),
    status,
    occurredAt,
    metadata: { ...usageEvent.metadata, ...metadata },
  };
}

export async function createUsageLedgerEntry({ usageEvent, pricedUsage, status = "PENDING", metadata = {} } = {}) {
  const payload = buildUsageLedgerEntry({ usageEvent, pricedUsage, status, metadata });
  const saved = await UsageLedgerEntry.create(payload);
  // Publish domain event (best-effort)
  try {
    await eventPublisher.publish("LedgerEntryCreated", { ledgerEntry: saved });
  } catch (_e) {
    // noop - do not fail ledger creation on publish errors
  }
  return saved;
}

export async function getUsageLedgerEntries({ hospitalId, feature, invoiceMonth, startDate, endDate, status } = {}) {
  const filter = {};
  if (hospitalId) filter.hospital = hospitalId;
  if (feature) filter.feature = feature;
  if (invoiceMonth) filter.invoiceMonth = invoiceMonth;
  if (status) filter.status = status;
  if (startDate || endDate) {
    filter.occurredAt = {};
    if (startDate) filter.occurredAt.$gte = new Date(startDate);
    if (endDate) filter.occurredAt.$lte = new Date(endDate);
  }
  return UsageLedgerEntry.find(filter).sort({ occurredAt: -1 }).lean();
}
