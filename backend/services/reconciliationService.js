import Financial from "../models/Financial.js";
import PaymentReceipt from "../models/PaymentReceipt.js";

function toNumber(value) {
  return Number(value || 0);
}

export async function buildReconciliationReport({ hospitalId } = {}) {
  if (!hospitalId) throw new Error("hospitalId is required");

  const invoiceQuery = Financial.find({ hospital: hospitalId });
  const receiptQuery = PaymentReceipt.find({ hospitalId });

  const [invoices, receipts] = await Promise.all([
    typeof invoiceQuery.lean === "function" ? invoiceQuery.lean() : invoiceQuery,
    typeof receiptQuery.lean === "function" ? receiptQuery.lean() : receiptQuery,
  ]);

  const summary = {
    invoiceCount: invoices.length,
    totalInvoiceAmount: invoices.reduce((sum, invoice) => sum + toNumber(invoice.total), 0),
    paidInvoiceCount: invoices.filter((invoice) => String(invoice.status || "").toUpperCase() === "PAID").length,
    unpaidInvoiceCount: invoices.filter((invoice) => String(invoice.status || "").toUpperCase() !== "PAID").length,
    receiptCount: receipts.length,
    totalReceiptAmount: receipts.reduce((sum, receipt) => sum + toNumber(receipt.amount), 0),
  };

  const issues = [];

  for (const receipt of receipts) {
    const invoice = invoices.find((row) => String(row._id) === String(receipt.invoiceId));
    if (!invoice) {
      issues.push({
        type: "ORPHAN_RECEIPT",
        receiptId: receipt._id,
        message: "Receipt references an invoice that is not present in this hospital context.",
      });
      continue;
    }

    const receivedAmount = toNumber(receipt.amount);
    const invoiceTotal = toNumber(invoice.total);
    if (receivedAmount > invoiceTotal) {
      issues.push({
        type: "OVERPAID_INVOICE",
        invoiceId: invoice._id,
        message: "Receipt amount exceeds invoice total.",
      });
    }
  }

  for (const invoice of invoices) {
    const matchingReceipts = receipts.filter((receipt) => String(receipt.invoiceId) === String(invoice._id));
    const paidAmount = matchingReceipts.reduce((sum, receipt) => sum + toNumber(receipt.amount), 0);
    if (String(invoice.status || "").toUpperCase() === "PAID" && paidAmount < toNumber(invoice.total)) {
      issues.push({
        type: "PAID_STATUS_MISMATCH",
        invoiceId: invoice._id,
        message: "Invoice is marked paid but receipt total is below the invoice total.",
      });
    }
  }

  return { summary, issues, generatedAt: new Date() };
}

export default { buildReconciliationReport };
