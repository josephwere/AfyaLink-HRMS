import { jest } from "@jest/globals";

const paymentReceiptFindOne = jest.fn();
const paymentReceiptCreate = jest.fn();
const paymentReceiptSave = jest.fn();
const financialFindById = jest.fn();
const financialSave = jest.fn();
const transitionPayment = jest.fn();

jest.unstable_mockModule("../models/PaymentReceipt.js", () => ({
  default: {
    findOne: paymentReceiptFindOne,
    create: paymentReceiptCreate,
  },
}));

jest.unstable_mockModule("../models/Financial.js", () => ({
  default: {
    findById: financialFindById,
  },
}));

jest.unstable_mockModule("../services/paymentLifecycleService.js", () => ({
  transitionPayment,
}));

describe("payment idempotency", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns the existing receipt for a duplicate idempotency key", async () => {
    paymentReceiptFindOne.mockResolvedValue({
      _id: "receipt-1",
      idempotencyKey: "idem-1",
      status: "PROCESSED",
      invoiceId: "invoice-1",
    });

    const { processPaymentWithIdempotency } = await import("../services/paymentIdempotencyService.js");
    const result = await processPaymentWithIdempotency({
      invoiceId: "invoice-1",
      amount: 100,
      method: "Card",
      idempotencyKey: "idem-1",
    });

    expect(result.duplicate).toBe(true);
    expect(result.receipt.status).toBe("PROCESSED");
    expect(paymentReceiptCreate).not.toHaveBeenCalled();
  });
});
