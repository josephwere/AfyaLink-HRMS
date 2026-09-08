import { jest } from "@jest/globals";

const consolidationEntityFind = jest.fn();
const consolidationEntityFindById = jest.fn();
const journalEntryFind = jest.fn();
const journalLineFind = jest.fn();
const eliminationFind = jest.fn();

jest.unstable_mockModule("../models/ConsolidationEntity.js", () => ({
  default: {
    find: consolidationEntityFind,
    findById: consolidationEntityFindById,
  },
}));

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

jest.unstable_mockModule("../models/ConsolidationElimination.js", () => ({
  default: {
    find: eliminationFind,
  },
}));

describe("consolidation service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("aggregates trial balances across active entities", async () => {
    consolidationEntityFind.mockReturnValue({ lean: jest.fn().mockResolvedValue([{ _id: "entity-1", isActive: true }]) });
    eliminationFind.mockReturnValue({ lean: jest.fn().mockResolvedValue([{ accountCode: "1100", direction: "DEBIT", amount: 20 }]) });
    journalEntryFind.mockReturnValue({ lean: jest.fn().mockResolvedValue([{ _id: "entry-1" }]) });
    journalLineFind.mockReturnValue({ lean: jest.fn().mockResolvedValue([
      { accountCode: "1100", direction: "DEBIT", amount: 100 },
      { accountCode: "4000", direction: "CREDIT", amount: 100 },
    ]) });

    const { ConsolidationService } = await import("../services/consolidationService.js");
    const result = await ConsolidationService.getConsolidatedTrialBalance({ ownershipPercentages: { "entity-1": 0.8 } });

    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ accountCode: "1100", debit: 60 }),
      expect.objectContaining({ accountCode: "4000", credit: 80 }),
    ]));
  });

  it("computes consolidated profit and loss from aggregated balances", async () => {
    consolidationEntityFind.mockReturnValue({ lean: jest.fn().mockResolvedValue([{ _id: "entity-1", isActive: true }]) });
    eliminationFind.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
    journalEntryFind.mockReturnValue({ lean: jest.fn().mockResolvedValue([{ _id: "entry-1" }]) });
    journalLineFind.mockReturnValue({ lean: jest.fn().mockResolvedValue([
      { accountCode: "4000", direction: "CREDIT", amount: 250 },
      { accountCode: "5000", direction: "DEBIT", amount: 100 },
    ]) });

    const { ConsolidationService } = await import("../services/consolidationService.js");
    const result = await ConsolidationService.getConsolidatedProfitAndLoss({ ownershipPercentages: { "entity-1": 0.8 } });

    expect(result).toEqual({ revenue: 200, expense: 80, net: 120 });
  });
});
