import { getPricingCatalogEntry } from "../services/pricingCatalogService.js";
import { recordUsage } from "../services/usageMeterService.js";
import { buildBillingSnapshot, buildInvoiceFromLedger } from "../services/billingEngineService.js";
import { getFeatureDefinitions } from "../services/featureRegistryService.js";

describe("billing architecture", () => {
  it("looks up pricing from a centralized catalog", async () => {
    const entry = await getPricingCatalogEntry({ feature: "SMS" });
    expect(entry).toBeTruthy();
    expect(entry.price).toBe(2);
    expect(entry.currency).toBe("KES");
  });

  it("records premium usage through the usage meter and ledger", async () => {
    const result = await recordUsage({
      hospital: { _id: "hospital-1" },
      feature: "AI_CHAT",
      quantity: 2300,
      metadata: { source: "chat" },
      persist: false,
    });

    expect(result.ledgerEntry.amount).toBe(57.5);
    expect(result.ledgerEntry.feature).toBe("AI_CHAT");
    expect(result.ledgerEntry.status).toBe("POSTED");
  });

  it("builds billing snapshots and invoices from the ledger", async () => {
    const result = await recordUsage({
      hospital: { _id: "hospital-2" },
      feature: "SMS",
      quantity: 150,
      persist: false,
    });

    const snapshot = buildBillingSnapshot({
      hospital: { _id: "hospital-2" },
      usageEntries: [result.ledgerEntry],
      now: new Date("2026-08-15T00:00:00.000Z"),
    });

    const invoice = buildInvoiceFromLedger({
      hospital: { _id: "hospital-2" },
      usageEntries: [result.ledgerEntry],
      invoiceNumber: "INV-001",
      period: "2026-08",
    });

    expect(snapshot.currentSpend).toBe(300);
    expect(snapshot.forecast.projectedMonthEndSpend).toBe(620);
    expect(invoice.total).toBe(300);
    expect(invoice.items[0].serviceName).toBe("Patient SMS");
  });

  it("exposes a feature registry for billing decisions", () => {
    const definitions = getFeatureDefinitions();
    const aiDefinition = definitions.find((entry) => entry.key === "AI_CHAT");
    expect(aiDefinition.billable).toBe(true);
    expect(aiDefinition.metered).toBe(true);
    expect(aiDefinition.core).toBe(false);
  });
});
