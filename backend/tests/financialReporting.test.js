import { jest } from "@jest/globals";

const journalEntryFind = jest.fn();
const journalLineFind = jest.fn();
const financialDimensionFind = jest.fn();

jest.unstable_mockModule("../models/JournalEntry.js", () => ({
  default: {
    find: journalEntryFind,
  },
}));

jest.unstable_mockModule("../models/JournalLine.js", () => ({
  default: {
    find: journalLineFind,
  },
}));

jest.unstable_mockModule("../models/FinancialDimension.js", () => ({
  default: {
    find: financialDimensionFind,
  },
}));

describe("financial reporting", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("builds a trial balance from journal lines", async () => {
    journalEntryFind.mockReturnValue({ lean: jest.fn().mockResolvedValue([{ _id: "entry-1" }]) });
    journalLineFind.mockReturnValue({ lean: jest.fn().mockResolvedValue([
      { accountCode: "1100", direction: "DEBIT", amount: 100 },
      { accountCode: "4000", direction: "CREDIT", amount: 100 },
    ]) });

    const { FinancialReportingService } = await import("../services/financialReportingService.js");
    const result = await FinancialReportingService.getTrialBalance();

    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ accountCode: "1100", debit: 100, credit: 0, net: 100 }),
      expect.objectContaining({ accountCode: "4000", debit: 0, credit: 100, net: -100 }),
    ]));
  });

  it("builds a profit and loss summary from journal lines", async () => {
    journalEntryFind.mockReturnValue({ lean: jest.fn().mockResolvedValue([{ _id: "entry-1" }]) });
    journalLineFind.mockReturnValue({ lean: jest.fn().mockResolvedValue([
      { accountCode: "4000", direction: "CREDIT", amount: 500 },
      { accountCode: "5000", direction: "DEBIT", amount: 300 },
    ]) });

    const { FinancialReportingService } = await import("../services/financialReportingService.js");
    const result = await FinancialReportingService.getProfitAndLoss();

    expect(result).toEqual({ revenue: 500, expense: 300, net: 200 });
  });

  it("returns a report snapshot with trial balance and statement summaries", async () => {
    journalEntryFind.mockReturnValue({ lean: jest.fn().mockResolvedValue([{ _id: "entry-1" }]) });
    journalLineFind.mockReturnValue({ lean: jest.fn().mockResolvedValue([
      { accountCode: "1100", direction: "DEBIT", amount: 100 },
      { accountCode: "4000", direction: "CREDIT", amount: 100 },
    ]) });

    const { FinancialReportingService } = await import("../services/financialReportingService.js");
    const result = await FinancialReportingService.getReportSnapshot({ asOfDate: "2026-08-05" });

    expect(result.asOfDate).toBe("2026-08-05");
    expect(result.trialBalance).toEqual(expect.arrayContaining([expect.objectContaining({ accountCode: "1100" })]));
    expect(result.profitAndLoss).toEqual(expect.objectContaining({ revenue: 100, expense: 0, net: 100 }));
  });

  it("aggregates financial dimensions for departmental or hospital reporting", async () => {
    financialDimensionFind.mockReturnValue({ lean: jest.fn().mockResolvedValue([
      { department: "Cardiology", exchangeRate: 1 },
      { department: "Cardiology", exchangeRate: 1 },
      { department: "Radiology", exchangeRate: 1 },
    ]) });

    const { FinancialReportingService } = await import("../services/financialReportingService.js");
    const result = await FinancialReportingService.getDimensionReport({ dimension: "department" });

    expect(result).toEqual(expect.objectContaining({ Cardiology: 2, Radiology: 1 }));
  });
});
