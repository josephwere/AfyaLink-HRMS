import { buildUsageEvent } from "../services/usageCollectorService.js";
import { getPricingCatalogEntry } from "../services/pricingCatalogService.js";
import { priceUsageEvent } from "../services/pricingEngineService.js";
import { buildUsageLedgerEntry } from "../services/usageLedgerService.js";
import { recordUsage } from "../services/usageMeterService.js";

describe("billing pipeline", () => {
  it("creates a usage event from hospital activity", () => {
    const usageEvent = buildUsageEvent({
      hospital: { _id: "hospital-1" },
      feature: "SMS",
      quantity: 250,
      unit: "message",
      metadata: { source: "reminder" },
      occurredAt: new Date("2026-08-03T11:43:00.000Z"),
    });

    expect(usageEvent.feature).toBe("SMS");
    expect(usageEvent.quantity).toBe(250);
    expect(usageEvent.unit).toBe("message");
    expect(usageEvent.metadata.source).toBe("reminder");
  });

  it("looks up versioned plan pricing from the catalog", async () => {
    const entry = await getPricingCatalogEntry({ feature: "SMS", plan: "COMMUNITY", asOf: new Date("2026-08-03T00:00:00.000Z") });
    expect(entry).toBeTruthy();
    expect(entry.price).toBe(1.8);
    expect(entry.currency).toBe("KES");
    expect(entry.version).toBe(1);
  });

  it("prices a usage event through the pricing engine", async () => {
    const usageEvent = buildUsageEvent({ hospital: { _id: "hospital-1" }, feature: "SMS", quantity: 250, unit: "message" });
    const result = await priceUsageEvent({ usageEvent, hospitalPlan: "COMMUNITY", asOf: new Date("2026-08-03T00:00:00.000Z") });

    expect(result.accepted).toBe(true);
    expect(result.pricedUsage.amount).toBe(450);
    expect(result.pricedUsage.unitPrice).toBe(1.8);
    expect(result.pricedUsage.chargeableQuantity).toBe(250);
  });

  it("builds a ledger entry from the priced usage event", () => {
    const usageEvent = buildUsageEvent({ hospital: { _id: "hospital-1" }, feature: "VOICE", quantity: 12, unit: "minute" });
    const pricedUsage = {
      serviceCode: "VOICE",
      serviceName: "Voice Dictation",
      category: "Voice",
      quantity: 12,
      unit: "minute",
      unitPrice: 10,
      freeTier: 0,
      chargeableQuantity: 12,
      amount: 120,
      currency: "KES",
      billingMode: "Per Minute",
      pricingVersion: 1,
      pricingEffectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
      plan: "DEFAULT",
    };
    const ledgerEntry = buildUsageLedgerEntry({ usageEvent, pricedUsage, status: "POSTED" });

    expect(ledgerEntry.amount).toBe(120);
    expect(ledgerEntry.unitPrice).toBe(10);
    expect(ledgerEntry.serviceCode).toBe("VOICE");
    expect(ledgerEntry.status).toBe("POSTED");
  });

  it("records usage through the meter without persisting", async () => {
    const result = await recordUsage({
      hospital: { _id: "hospital-2", plan: "NATIONAL" },
      feature: "AI_CHAT",
      quantity: 5,
      unit: "1000 Tokens",
      persist: false,
      occurredAt: new Date("2026-08-04T10:00:00.000Z"),
    });

    expect(result.accepted).toBe(true);
    expect(result.pricedUsage.unitPrice).toBe(8);
    expect(result.ledgerEntry.amount).toBe(40);
    expect(result.ledgerEntry.plan).toBe("NATIONAL");
  });
});
