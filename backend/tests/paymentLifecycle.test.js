import { jest } from "@jest/globals";

jest.unstable_mockModule("../models/Financial.js", () => ({
  default: {
    findById: jest.fn().mockResolvedValue({
      _id: "invoice-1",
      invoiceNumber: "TEST-001",
      paymentLifecycleStatus: "ISSUED",
      status: "Pending",
      save: jest.fn().mockResolvedValue(true),
    }),
  },
}));

jest.unstable_mockModule("../models/BillingEvent.js", () => ({
  default: {
    create: jest.fn().mockResolvedValue({ eventName: "InvoicePaid" }),
  },
}));

jest.unstable_mockModule("../services/eventPublisher.js", () => ({
  default: {
    publish: jest.fn().mockResolvedValue(true),
  },
}));

describe("payment lifecycle", () => {
  it("transitions invoice payments through a dedicated lifecycle state", async () => {
    const { transitionPayment } = await import("../services/paymentLifecycleService.js");

    const result = await transitionPayment({
      invoiceId: "invoice-1",
      eventName: "InvoicePaid",
      status: "PAID",
      payload: { amount: 100, total: 100 },
    });

    expect(result.invoice.paymentLifecycleStatus).toBe("PAID");
    expect(result.event.eventName).toBe("InvoicePaid");
  });
});
