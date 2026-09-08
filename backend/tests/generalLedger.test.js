import { jest } from "@jest/globals";

const financialCreate = jest.fn();
const transitionInvoice = jest.fn();
const eventPublisherPublish = jest.fn();
const getUsageLedgerEntries = jest.fn();
const postEntry = jest.fn();

jest.unstable_mockModule("../models/Financial.js", () => ({
  default: {
    create: financialCreate,
  },
}));

jest.unstable_mockModule("../services/idGenerator.js", () => ({
  generateInvoiceId: jest.fn().mockResolvedValue("INV-001"),
}));

jest.unstable_mockModule("../services/usageLedgerService.js", () => ({
  getUsageLedgerEntries,
}));

jest.unstable_mockModule("../services/eventPublisher.js", () => ({
  default: {
    publish: eventPublisherPublish,
  },
}));

jest.unstable_mockModule("../services/billingLifecycleService.js", () => ({
  transitionInvoice,
}));

jest.unstable_mockModule("../services/generalLedgerService.js", () => ({
  GeneralLedgerService: { postEntry },
  default: { postEntry },
}));

describe("general ledger posting", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getUsageLedgerEntries.mockResolvedValue([{ featureCode: "LAB_TEST", amount: 120, quantity: 1 }]);
    financialCreate.mockResolvedValue({ _id: "invoice-1", hospital: "hospital-1" });
    transitionInvoice.mockResolvedValue({});
    eventPublisherPublish.mockResolvedValue({});
    postEntry.mockResolvedValue({ _id: "entry-1" });
  });

  it("posts a journal entry when an invoice is generated from ledger entries", async () => {
    const { generateInvoiceFromLedger } = await import("../services/invoiceGeneratorService.js");

    await generateInvoiceFromLedger({ hospitalId: "hospital-1", invoiceMonth: "2024-10" });

    expect(postEntry).toHaveBeenCalledWith(expect.objectContaining({
      entryType: "INVOICE_ISSUED",
      hospitalId: "hospital-1",
      invoiceId: "invoice-1",
      description: expect.stringContaining("Invoice"),
    }));
  });
});
