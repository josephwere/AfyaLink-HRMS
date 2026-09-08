import { FEATURE_CODES } from "../constants/featureCodes.js";
import { buildHospitalFinancialIntelligence, buildUsageLedgerEntry } from "../services/hospitalFinancialIntelligenceService.js";
import { buildInvoiceFromLedger } from "../services/billingEngineService.js";

describe("hospital financial intelligence", () => {
  it("builds a forecast and optimization suggestions from usage entries", () => {
    const hospital = {
      _id: "hospital-1",
      name: "Test Hospital",
      billing: {
        monthlyTarget: 100000,
        monthlySpent: 0,
        balanceOutstanding: 25000,
        paymentDueAt: new Date("2026-08-31T00:00:00.000Z"),
        status: "PAYMENT_DUE",
      },
    };

    const now = new Date("2026-08-15T09:00:00.000Z");
    const usageEntries = [
      {
        createdAt: new Date("2026-08-03T09:12:00.000Z"),
        serviceCode: "AI_DIAGNOSIS",
        serviceName: "AI Diagnosis",
        category: "AI",
        quantity: 1,
        unit: "request",
        unitPrice: 15,
        amount: 15,
        currency: "KES",
      },
      {
        createdAt: new Date("2026-08-03T09:20:00.000Z"),
        serviceCode: "SMS",
        serviceName: "SMS Reminder",
        category: "SMS",
        quantity: 35,
        unit: "message",
        unitPrice: 2,
        amount: 70,
        currency: "KES",
      },
      {
        createdAt: new Date("2026-08-03T10:01:00.000Z"),
        serviceCode: "VOICE",
        serviceName: "Voice Dictation",
        category: "VOICE",
        quantity: 8,
        unit: "minute",
        unitPrice: 10,
        amount: 80,
        currency: "KES",
      },
      {
        createdAt: new Date("2026-08-03T11:30:00.000Z"),
        serviceCode: "OCR",
        serviceName: "OCR Document",
        category: "OCR",
        quantity: 5,
        unit: "page",
        unitPrice: 5,
        amount: 25,
        currency: "KES",
      },
    ];

    const snapshot = buildHospitalFinancialIntelligence({ hospital, usageEntries, now });

    expect(snapshot.summary.currentSpend).toBe(190);
    expect(snapshot.summary.remainingBudget).toBe(99810);
    expect(snapshot.forecast.projectedMonthEndSpend).toBe(393);
    expect(snapshot.suggestions.some((item) => item.message.includes("premium spending"))).toBe(true);
  });

  it("builds a usage ledger entry from catalog pricing", () => {
    const entry = buildUsageLedgerEntry({
      hospitalId: "hospital-2",
      serviceCode: "AI_CHAT",
      serviceName: "AI Chat",
      category: "AI",
      quantity: 5,
      unit: "1,000 tokens",
      unitPrice: 15,
      currency: "KES",
    });

    expect(entry.amount).toBe(75);
    expect(entry.unitPrice).toBe(15);
    expect(entry.currency).toBe("KES");
  });

  it("aggregates spend by immutable feature code and preserves invoice determinism", () => {
    const usageEntries = [
      {
        featureCode: FEATURE_CODES.AI_CHAT,
        serviceCode: "AI_REQUEST",
        serviceName: "AI Medical Assistant",
        category: "AI",
        quantity: 2,
        unitPrice: 15,
        amount: 30,
        currency: "KES",
      },
      {
        featureCode: FEATURE_CODES.AI_CHAT,
        serviceCode: "AI_REQUEST",
        serviceName: "AI Medical Assistant",
        category: "AI",
        quantity: 1,
        unitPrice: 15,
        amount: 15,
        currency: "KES",
      },
      {
        featureCode: FEATURE_CODES.PATIENT_SMS,
        serviceCode: "COMMUNICATION_MESSAGE",
        serviceName: "Patient SMS",
        category: "SMS",
        quantity: 5,
        unitPrice: 2,
        amount: 10,
        currency: "KES",
      },
    ];

    const snapshot = buildHospitalFinancialIntelligence({ hospital: { billing: {} }, usageEntries, now: new Date("2026-08-15T00:00:00.000Z") });
    const invoice = buildInvoiceFromLedger({ hospital: { _id: "hospital-2" }, usageEntries, invoiceNumber: "INV-002", period: "2026-08" });

    expect(snapshot.featureBreakdown[0].category).toBe(FEATURE_CODES.AI_CHAT);
    expect(snapshot.featureBreakdown[0].amount).toBe(45);
    expect(invoice.items[0].serviceName).toBe("AI Medical Assistant");
    expect(invoice.items[0].amount).toBe(30);
  });
});
