import JournalEntry from "../models/JournalEntry.js";
import JournalLine from "../models/JournalLine.js";
import ChartOfAccount from "../models/ChartOfAccount.js";
import AccountingPeriod from "../models/AccountingPeriod.js";

export class GeneralLedgerService {
  static async postEntry({
    entryType,
    hospitalId,
    invoiceId = null,
    paymentReceiptId = null,
    description,
    currency = "KES",
    accountingPeriodKey = null,
    lines,
    metadata = {},
  }) {
    if (!Array.isArray(lines) || lines.length === 0) {
      throw new Error("Journal lines are required");
    }

    const totalDebit = lines.reduce((sum, line) => sum + (line.direction === "DEBIT" ? Number(line.amount || 0) : 0), 0);
    const totalCredit = lines.reduce((sum, line) => sum + (line.direction === "CREDIT" ? Number(line.amount || 0) : 0), 0);

    if (totalDebit !== totalCredit) {
      throw new Error(`Journal entry must balance: debit=${totalDebit}, credit=${totalCredit}`);
    }

    for (const line of lines) {
      const account = await ChartOfAccount.findOne({ code: line.accountCode });
      if (!account) {
        throw new Error(`Chart of account ${line.accountCode} was not found`);
      }
      if (account.status === "ARCHIVED") {
        throw new Error(`Cannot post to archived account ${line.accountCode}`);
      }
      if (account.normalBalance && account.normalBalance !== line.direction) {
        throw new Error(`Account ${line.accountCode} expects ${account.normalBalance} entries`);
      }
    }

    if (accountingPeriodKey) {
      const accountingPeriod = await AccountingPeriod.findOne({ periodKey: accountingPeriodKey });
      if (!accountingPeriod) {
        throw new Error(`Accounting period ${accountingPeriodKey} was not found`);
      }
      if (["CLOSED", "LOCKED"].includes(accountingPeriod.status)) {
        throw new Error(`Accounting period ${accountingPeriodKey} is closed`);
      }
    }

    const entryNumber = `JE-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const entry = await JournalEntry.create({
      entryNumber,
      entryType,
      hospitalId,
      invoiceId,
      paymentReceiptId,
      description,
      currency,
      totalDebit,
      totalCredit,
      isImmutable: true,
      metadata,
    });

    if (!entry || !entry._id) {
      throw new Error("Journal entry could not be created");
    }

    const journalLines = lines.map((line) => ({
      journalEntryId: entry._id,
      accountCode: line.accountCode,
      accountName: line.accountName,
      direction: line.direction,
      amount: Number(line.amount || 0),
      description: line.description || description,
    }));

    await JournalLine.insertMany(journalLines);

    return entry;
  }
}

export default GeneralLedgerService;
