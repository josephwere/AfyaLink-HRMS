import { jest } from "@jest/globals";

const chartOfAccountFindOne = jest.fn();
const accountingPeriodFindOne = jest.fn();
const accountingPeriodCreate = jest.fn();
const journalEntryCreate = jest.fn();
const journalLineInsertMany = jest.fn();

jest.unstable_mockModule("../models/ChartOfAccount.js", () => ({
  default: {
    findOne: chartOfAccountFindOne,
  },
}));

jest.unstable_mockModule("../models/AccountingPeriod.js", () => ({
  default: {
    findOne: accountingPeriodFindOne,
    create: accountingPeriodCreate,
  },
}));

jest.unstable_mockModule("../models/JournalEntry.js", () => ({
  default: {
    create: journalEntryCreate,
  },
}));

jest.unstable_mockModule("../models/JournalLine.js", () => ({
  default: {
    insertMany: journalLineInsertMany,
  },
}));

describe("general ledger controls", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects postings to archived accounts", async () => {
    chartOfAccountFindOne.mockResolvedValueOnce({ code: "1100", status: "ARCHIVED", normalBalance: "DEBIT" });
    accountingPeriodFindOne.mockResolvedValue({ _id: "period-1", status: "OPEN" });

    const { GeneralLedgerService } = await import("../services/generalLedgerService.js");

    await expect(GeneralLedgerService.postEntry({
      entryType: "INVOICE_ISSUED",
      hospitalId: "hospital-1",
      description: "Invalid archived account",
      lines: [
        { accountCode: "1100", accountName: "Cash", direction: "DEBIT", amount: 100 },
        { accountCode: "4000", accountName: "Revenue", direction: "CREDIT", amount: 100 },
      ],
    })).rejects.toThrow(/archived/i);
  });

  it("rejects postings to closed accounting periods", async () => {
    chartOfAccountFindOne.mockResolvedValueOnce({ code: "1100", status: "ACTIVE", normalBalance: "DEBIT" });
    chartOfAccountFindOne.mockResolvedValueOnce({ code: "4000", status: "ACTIVE", normalBalance: "CREDIT" });
    accountingPeriodFindOne.mockResolvedValue({ _id: "period-1", status: "CLOSED" });

    const { GeneralLedgerService } = await import("../services/generalLedgerService.js");

    await expect(GeneralLedgerService.postEntry({
      entryType: "INVOICE_ISSUED",
      hospitalId: "hospital-1",
      description: "Closed period",
      accountingPeriodKey: "2024-10",
      lines: [
        { accountCode: "1100", accountName: "Cash", direction: "DEBIT", amount: 100 },
        { accountCode: "4000", accountName: "Revenue", direction: "CREDIT", amount: 100 },
      ],
    })).rejects.toThrow(/closed/i);
  });
});
