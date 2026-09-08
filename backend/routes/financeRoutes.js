import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import {
  getCurrentShift,
  listShifts,
  getShift,
  createShift,
  closeShift,
  approveShift,
  rejectShift,
  reopenShift,
} from "../controllers/financeController.js";
import {
  createInvoice,
  listFinanceInvoices,
  getFinanceInvoice,
  voidFinanceInvoice,
  listFinancePayments,
  getFinancePayment,
  createFinancePayment,
  listFinanceReceipts,
  getFinanceReceipt,
  listAccountingPeriods,
  getAccountingPeriod,
  listChartOfAccounts,
  getChartOfAccount,
  getGeneralLedger,
  getJournalEntries,
  getFinanceReconciliation,
} from "../controllers/financialController.js";
import { getWorkCenter } from "../controllers/financeWorkCenterController.js";

const router = express.Router();
const CASHIER_ROLES = [
  "RECEPTIONIST",
  "PAYROLL_OFFICER",
  "CASHIER",
  "HOSPITAL_ADMIN",
  "HOSPITAL_ADMIN_ASSISTANT",
  "SUPER_ADMIN",
  "SYSTEM_ADMIN",
  "DEVELOPER",
];
const FINANCE_APPROVER_ROLES = [
  "ACCOUNTANT",
  "FINANCE_MANAGER",
  "CFO",
  "HOSPITAL_ADMIN",
  "SUPER_ADMIN",
  "SYSTEM_ADMIN",
  "DEVELOPER",
];
const WORK_CENTER_VIEW_ROLES = [...new Set([...CASHIER_ROLES, ...FINANCE_APPROVER_ROLES])];
const SHIFT_READ_ROLES = [...new Set([...CASHIER_ROLES, ...FINANCE_APPROVER_ROLES])];

router.get("/shifts/current", protect, requireRole(...SHIFT_READ_ROLES), getCurrentShift);
router.get("/shifts", protect, requireRole(...SHIFT_READ_ROLES), listShifts);
router.get("/shifts/:id", protect, requireRole(...SHIFT_READ_ROLES), getShift);
router.post("/shifts", protect, requireRole(...CASHIER_ROLES), createShift);
router.post("/shifts/:id/close", protect, requireRole(...CASHIER_ROLES), closeShift);
router.post("/shifts/:id/approve", protect, requireRole(...FINANCE_APPROVER_ROLES), approveShift);
router.post("/shifts/:id/reject", protect, requireRole(...FINANCE_APPROVER_ROLES), rejectShift);
router.post("/shifts/:id/reopen", protect, requireRole(...CASHIER_ROLES), reopenShift);
router.get("/work-center", protect, requireRole(...WORK_CENTER_VIEW_ROLES), getWorkCenter);

router.get("/invoices", protect, requireRole(...SHIFT_READ_ROLES), listFinanceInvoices);
router.get("/invoices/:id", protect, requireRole(...SHIFT_READ_ROLES), getFinanceInvoice);
router.post("/invoices", protect, requireRole(...CASHIER_ROLES), createInvoice);
router.post("/invoices/:id/void", protect, requireRole(...CASHIER_ROLES), voidFinanceInvoice);
router.get("/payments", protect, requireRole(...SHIFT_READ_ROLES), listFinancePayments);
router.get("/payments/:id", protect, requireRole(...SHIFT_READ_ROLES), getFinancePayment);
router.post("/payments", protect, requireRole(...CASHIER_ROLES), createFinancePayment);
router.get("/receipts", protect, requireRole(...SHIFT_READ_ROLES), listFinanceReceipts);
router.get("/receipts/:id", protect, requireRole(...SHIFT_READ_ROLES), getFinanceReceipt);

router.get("/periods", protect, requireRole(...FINANCE_APPROVER_ROLES), listAccountingPeriods);
router.get("/periods/:id", protect, requireRole(...FINANCE_APPROVER_ROLES), getAccountingPeriod);
router.get("/chart-of-accounts", protect, requireRole(...FINANCE_APPROVER_ROLES), listChartOfAccounts);
router.get("/chart-of-accounts/:id", protect, requireRole(...FINANCE_APPROVER_ROLES), getChartOfAccount);
router.get("/general-ledger", protect, requireRole(...FINANCE_APPROVER_ROLES), getGeneralLedger);
router.get("/journal-entries", protect, requireRole(...FINANCE_APPROVER_ROLES), getJournalEntries);
router.get("/journals", protect, requireRole(...FINANCE_APPROVER_ROLES), getJournalEntries);
router.get("/reconciliation", protect, requireRole(...FINANCE_APPROVER_ROLES), getFinanceReconciliation);

export default router;
