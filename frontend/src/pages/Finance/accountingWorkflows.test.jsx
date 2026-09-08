import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import AccountingDashboard from "./AccountingDashboard";
import ChartOfAccounts from "./ChartOfAccounts";
import FinanceManagerDashboard from "./ManagerDashboard";

vi.mock("../../services/finance/chartOfAccountsApi", () => ({
  listChartOfAccounts: vi.fn(),
  getAccount: vi.fn(),
}));

vi.mock("../../services/finance/ledgerApi", () => ({
  getGeneralLedger: vi.fn(),
  getJournalEntries: vi.fn(),
}));

vi.mock("../../services/finance/periodsApi", () => ({
  listAccountingPeriods: vi.fn(),
  getAccountingPeriod: vi.fn(),
}));

vi.mock("../../services/finance/reconciliationApi", () => ({
  listReconciliationItems: vi.fn(),
  getReconciliationSummary: vi.fn(),
}));

import { listChartOfAccounts } from "../../services/finance/chartOfAccountsApi";
import { getGeneralLedger, getJournalEntries } from "../../services/finance/ledgerApi";
import { listAccountingPeriods } from "../../services/finance/periodsApi";
import { listReconciliationItems } from "../../services/finance/reconciliationApi";

describe("Accountant finance workflows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the accounting dashboard with real operational panels", async () => {
    getGeneralLedger.mockResolvedValue({
      items: [
        { _id: "gl-1", description: "Consultation revenue", debit: 1200, credit: 0, balance: 1200 },
      ],
      total: 1,
    });
    getJournalEntries.mockResolvedValue({
      items: [
        { _id: "je-1", entryNumber: "JE-1001", description: "Revenue posting", totalDebit: 1200, totalCredit: 1200, status: "POSTED" },
      ],
      total: 1,
    });
    listAccountingPeriods.mockResolvedValue({
      items: [{ _id: "p-1", periodKey: "2026-08", label: "August 2026", status: "OPEN" }],
      total: 1,
    });
    listReconciliationItems.mockResolvedValue({
      items: [{ _id: "r-1", type: "PAYMENT_MATCH", status: "MATCHED" }],
      total: 1,
    });

    render(<AccountingDashboard />);

    expect(await screen.findByText("Accounting Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Financial position")).toBeInTheDocument();
    expect(screen.getByText("Today's transactions")).toBeInTheDocument();
    expect(screen.getByText("Reconciliation status")).toBeInTheDocument();
  });

  it("loads chart-of-accounts data into a usable account table", async () => {
    listChartOfAccounts.mockResolvedValue({
      items: [
        { _id: "a-1", code: "1000", name: "Cash", category: "ASSET", normalBalance: "DEBIT", status: "ACTIVE" },
        { _id: "a-2", code: "4000", name: "Revenue", category: "REVENUE", normalBalance: "CREDIT", status: "ACTIVE" },
      ],
      total: 2,
    });

    render(<ChartOfAccounts />);

    expect(await screen.findByText("Cash")).toBeInTheDocument();
    expect(screen.getByText("Revenue")).toBeInTheDocument();
    expect(screen.getByText("Chart of Accounts")).toBeInTheDocument();
  });

  it("renders the finance manager dashboard with operational control KPIs", async () => {
    getGeneralLedger.mockResolvedValue({
      items: [
        { _id: "gl-1", description: "Revenue posting", balance: 540000 },
        { _id: "gl-2", description: "Expense posting", balance: 210000 },
      ],
      total: 2,
    });
    getJournalEntries.mockResolvedValue({
      items: [{ _id: "je-1", entryNumber: "JE-2201", description: "Monthly close", totalDebit: 540000, totalCredit: 540000, status: "POSTED" }],
      total: 1,
    });
    listAccountingPeriods.mockResolvedValue({
      items: [{ _id: "p-1", periodKey: "2026-08", label: "August 2026", status: "OPEN" }],
      total: 1,
    });
    listReconciliationItems.mockResolvedValue({
      items: [{ _id: "r-1", type: "PAYMENT_MATCH", status: "PENDING" }],
      total: 1,
    });

    render(<FinanceManagerDashboard />);

    expect(await screen.findByText("Finance Manager Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Cash position")).toBeInTheDocument();
    expect(screen.getByText("Pending approvals")).toBeInTheDocument();
    expect(screen.getByText("Reconciliation exceptions")).toBeInTheDocument();
  });
});
