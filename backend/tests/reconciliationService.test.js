import { jest } from "@jest/globals";

const financialFindMock = jest.fn();
const paymentReceiptFindMock = jest.fn();

jest.unstable_mockModule("../models/Financial.js", () => ({
  default: {
    find: financialFindMock,
  },
}));

jest.unstable_mockModule("../models/PaymentReceipt.js", () => ({
  default: {
    find: paymentReceiptFindMock,
  },
}));

describe("reconciliation report", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    financialFindMock.mockResolvedValue([
      { _id: "inv-1", total: 100, status: "PAID" },
      { _id: "inv-2", total: 50, status: "Pending" },
    ]);
    paymentReceiptFindMock.mockResolvedValue([
      { _id: "receipt-1", invoiceId: "inv-1", amount: 100 },
      { _id: "receipt-2", invoiceId: "inv-9", amount: 75 },
      { _id: "receipt-3", invoiceId: "inv-2", amount: 60 },
    ]);
  });

  it("builds a reconciliation report with issues and totals", async () => {
    const { buildReconciliationReport } = await import("../services/reconciliationService.js");
    const report = await buildReconciliationReport({ hospitalId: "hospital-1" });

    expect(report.summary.invoiceCount).toBe(2);
    expect(report.summary.receiptCount).toBe(3);
    expect(report.issues.some((issue) => issue.type === "ORPHAN_RECEIPT")).toBe(true);
    expect(report.issues.some((issue) => issue.type === "OVERPAID_INVOICE")).toBe(true);
  });
});
