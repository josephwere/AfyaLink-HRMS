import { jest } from "@jest/globals";

jest.unstable_mockModule("../models/Financial.js", () => ({
  default: {
    findById: jest.fn().mockResolvedValue({
      _id: "invoice-1",
      invoiceNumber: "TEST-001",
      status: "Pending",
      lifecycleStatus: "DRAFT",
      save: jest.fn().mockResolvedValue(true),
    }),
  },
}));

jest.unstable_mockModule("../models/BillingEvent.js", () => ({
  default: {
    create: jest.fn().mockResolvedValue({ eventName: "InvoiceGenerated" }),
  },
}));

describe("invoice lifecycle", () => {
  it("transitions an invoice through lifecycle states and records an event", async () => {
    const { transitionInvoice } = await import("../services/billingLifecycleService.js");

    const result = await transitionInvoice({
      invoiceId: "invoice-1",
      eventName: "InvoiceGenerated",
      status: "GENERATED",
      payload: { total: 0 },
    });

    expect(result.invoice.lifecycleStatus).toBe("GENERATED");
    expect(result.event.eventName).toBe("InvoiceGenerated");
  });
});
