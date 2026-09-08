import { jest } from "@jest/globals";

const consolidationRunCreate = jest.fn();
const consolidationRunFindById = jest.fn();
const consolidationAdjustmentFind = jest.fn();
const consolidationEliminationFind = jest.fn();
const journalEntryCreate = jest.fn();
const journalLineCreate = jest.fn();

jest.unstable_mockModule("../models/ConsolidationRun.js", () => ({
  default: {
    create: consolidationRunCreate,
    findById: consolidationRunFindById,
  },
}));

jest.unstable_mockModule("../models/ConsolidationAdjustment.js", () => ({
  default: {
    find: consolidationAdjustmentFind,
  },
}));

jest.unstable_mockModule("../models/ConsolidationElimination.js", () => ({
  default: {
    find: consolidationEliminationFind,
  },
}));

jest.unstable_mockModule("../models/JournalEntry.js", () => ({
  default: {
    create: journalEntryCreate,
  },
}));

jest.unstable_mockModule("../models/JournalLine.js", () => ({
  default: {
    create: journalLineCreate,
  },
}));

describe("consolidation run service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a draft consolidation run", async () => {
    consolidationRunCreate.mockResolvedValue({ _id: "run-1", status: "DRAFT" });

    const { ConsolidationRunService } = await import("../services/consolidationRunService.js");
    const result = await ConsolidationRunService.createRun({ groupId: "group-1", period: "2026-08" });

    expect(result.status).toBe("DRAFT");
  });

  it("creates an elimination journal entry for a consolidation run", async () => {
    consolidationRunFindById.mockResolvedValue({ _id: "run-1", groupId: "group-1", save: jest.fn().mockResolvedValue(true) });
    journalEntryCreate.mockResolvedValue({ _id: "entry-1" });

    const { ConsolidationRunService } = await import("../services/consolidationRunService.js");
    const result = await ConsolidationRunService.createEliminationJournal({ runId: "run-1", accountCode: "1100", amount: 100, direction: "DEBIT", description: "Elimination" });

    expect(result._id).toBe("entry-1");
    expect(journalLineCreate).toHaveBeenCalled();
  });
});
