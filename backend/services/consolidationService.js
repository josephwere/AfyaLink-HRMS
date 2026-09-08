import JournalEntry from "../models/JournalEntry.js";
import JournalLine from "../models/JournalLine.js";
import ConsolidationEntity from "../models/ConsolidationEntity.js";
import ConsolidationElimination from "../models/ConsolidationElimination.js";

export class ConsolidationService {
  static async getConsolidatedTrialBalance({ entityId = null, asOfDate = null, ownershipPercentages = {} } = {}) {
    const entities = entityId
      ? [await ConsolidationEntity.findById(entityId).lean()]
      : await ConsolidationEntity.find({ isActive: true }).lean();

    const balances = new Map();
    const eliminations = await ConsolidationElimination.find({ parentEntityId: entityId || { $exists: true }, status: "APPLIED" }).lean();

    for (const entity of entities) {
      const ownership = Number(ownershipPercentages[entity._id] ?? 1);
      const query = { hospitalId: entity._id };
      if (asOfDate) query.postedAt = { $lte: new Date(asOfDate) };

      const entries = await JournalEntry.find(query).lean();
      const lines = await JournalLine.find({ journalEntryId: { $in: entries.map((entry) => entry._id) } }).lean();

      for (const line of lines) {
        const current = balances.get(line.accountCode) || { accountCode: line.accountCode, debit: 0, credit: 0 };
        const amount = Number(line.amount || 0) * ownership;
        if (line.direction === "DEBIT") current.debit += amount;
        if (line.direction === "CREDIT") current.credit += amount;
        balances.set(line.accountCode, current);
      }
    }

    for (const elimination of eliminations) {
      const current = balances.get(elimination.accountCode) || { accountCode: elimination.accountCode, debit: 0, credit: 0 };
      if (elimination.direction === "DEBIT") current.debit -= Number(elimination.amount || 0);
      if (elimination.direction === "CREDIT") current.credit -= Number(elimination.amount || 0);
      balances.set(elimination.accountCode, current);
    }

    return Array.from(balances.values()).map((row) => ({
      ...row,
      net: Number(row.debit || 0) - Number(row.credit || 0),
    }));
  }

  static async getConsolidatedProfitAndLoss({ entityId = null, asOfDate = null, ownershipPercentages = {} } = {}) {
    const trialBalance = await this.getConsolidatedTrialBalance({ entityId, asOfDate, ownershipPercentages });
    const revenue = trialBalance.filter((row) => String(row.accountCode).startsWith("4")).reduce((sum, row) => sum + Number(row.credit || 0), 0);
    const expense = trialBalance.filter((row) => String(row.accountCode).startsWith("5")).reduce((sum, row) => sum + Number(row.debit || 0), 0);

    return { revenue, expense, net: revenue - expense };
  }
}

export default ConsolidationService;
