import JournalEntry from "../models/JournalEntry.js";
import JournalLine from "../models/JournalLine.js";
import FinancialDimension from "../models/FinancialDimension.js";

export class FinancialReportingService {
  static async getTrialBalance({ hospitalId = null, periodKey = null, asOfDate = null } = {}) {
    const query = {};
    if (hospitalId) query.hospitalId = hospitalId;
    if (asOfDate) query.postedAt = { $lte: new Date(asOfDate) };

    const entries = await JournalEntry.find(query).lean();
    const lines = await JournalLine.find({ journalEntryId: { $in: entries.map((entry) => entry._id) } }).lean();

    const balances = new Map();

    for (const line of lines) {
      const current = balances.get(line.accountCode) || { accountCode: line.accountCode, debit: 0, credit: 0 };
      if (line.direction === "DEBIT") current.debit += Number(line.amount || 0);
      if (line.direction === "CREDIT") current.credit += Number(line.amount || 0);
      balances.set(line.accountCode, current);
    }

    return Array.from(balances.values()).map((row) => ({
      ...row,
      net: Number(row.debit || 0) - Number(row.credit || 0),
    }));
  }

  static async getGeneralLedgerReport({ hospitalId = null, periodKey = null, asOfDate = null } = {}) {
    const query = {};
    if (hospitalId) query.hospitalId = hospitalId;
    if (asOfDate) query.postedAt = { $lte: new Date(asOfDate) };

    const entries = await JournalEntry.find(query).sort({ postedAt: 1 }).lean();
    return entries.map((entry) => ({
      entryNumber: entry.entryNumber,
      description: entry.description,
      entryType: entry.entryType,
      totalDebit: entry.totalDebit,
      totalCredit: entry.totalCredit,
      postedAt: entry.postedAt,
    }));
  }

  static async getProfitAndLoss({ hospitalId = null, periodKey = null, asOfDate = null, dimension = null } = {}) {
    const query = {};
    if (hospitalId) query.hospitalId = hospitalId;
    if (asOfDate) query.postedAt = { $lte: new Date(asOfDate) };

    const entries = await JournalEntry.find(query).lean();
    const lines = await JournalLine.find({ journalEntryId: { $in: entries.map((entry) => entry._id) } }).lean();

    const totals = { revenue: 0, expense: 0 };

    for (const line of lines) {
      if (line.accountCode.startsWith("4")) totals.revenue += Number(line.direction === "CREDIT" ? line.amount : 0);
      if (line.accountCode.startsWith("5")) totals.expense += Number(line.direction === "DEBIT" ? line.amount : 0);
    }

    return {
      revenue: totals.revenue,
      expense: totals.expense,
      net: totals.revenue - totals.expense,
    };
  }

  static async getBalanceSheet({ hospitalId = null, periodKey = null, asOfDate = null } = {}) {
    const query = {};
    if (hospitalId) query.hospitalId = hospitalId;
    if (asOfDate) query.postedAt = { $lte: new Date(asOfDate) };

    const entries = await JournalEntry.find(query).lean();
    const lines = await JournalLine.find({ journalEntryId: { $in: entries.map((entry) => entry._id) } }).lean();

    const totals = { assets: 0, liabilities: 0, equity: 0 };

    for (const line of lines) {
      if (line.accountCode.startsWith("1")) totals.assets += Number(line.direction === "DEBIT" ? line.amount : 0);
      if (line.accountCode.startsWith("2")) totals.liabilities += Number(line.direction === "CREDIT" ? line.amount : 0);
      if (line.accountCode.startsWith("3")) totals.equity += Number(line.direction === "CREDIT" ? line.amount : 0);
    }

    return totals;
  }

  static async getDimensionReport({ dimension, hospitalId = null, asOfDate = null } = {}) {
    const query = {};
    if (hospitalId) query.hospitalId = hospitalId;
    if (asOfDate) query.createdAt = { $lte: new Date(asOfDate) };

    const dimensions = await FinancialDimension.find(query).lean();
    return dimensions.reduce((acc, item) => {
      const key = item[dimension] || "UNASSIGNED";
      acc[key] = (acc[key] || 0) + Number(item.exchangeRate || 1);
      return acc;
    }, {});
  }

  static async getReportSnapshot({ hospitalId = null, asOfDate = null } = {}) {
    const trialBalance = await this.getTrialBalance({ hospitalId, asOfDate });
    const profitAndLoss = await this.getProfitAndLoss({ hospitalId, asOfDate });
    const balanceSheet = await this.getBalanceSheet({ hospitalId, asOfDate });

    return {
      asOfDate: asOfDate || new Date().toISOString(),
      trialBalance,
      profitAndLoss,
      balanceSheet,
    };
  }
}

export default FinancialReportingService;
