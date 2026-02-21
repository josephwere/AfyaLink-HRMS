import Receipt from "../models/Receipt.js";
import LedgerEntry from "../models/LedgerEntry.js";
import Invoice from "../models/Invoice.js";
import Workflow from "../models/Workflow.js";
import { logAudit } from "./auditService.js";

/**
 * FINALIZE PAYMENT
 * 🔒 THE ONLY PLACE allowed to:
 * - create Receipt
 * - create LedgerEntry
 * - mark Invoice paid
 */
export async function finalizePayment({
  workflowId,
  payment,
  actor,
}) {
  /* ================= SAFETY ================= */
  const workflow = await Workflow.findById(workflowId);
  if (!workflow) throw new Error("Workflow not found");

  if (workflow.state === "COMPLETED") {
    throw new Error("Payment already finalized");
  }

  /* ================= RECEIPT ================= */
  const receiptNo = `RCPT-${Date.now()}`;

  const receipt = new Receipt({
    receiptNo,
    paymentId: payment._id,
    invoiceId: payment.invoice,
    patient: payment.patient,
    hospital: payment.hospital,
    amount: payment.amount,
    currency: payment.currency,
    method: payment.method,
  });

  receipt.$locals.viaWorkflow = true;
  receipt.$locals.workflowId = workflowId;

  await receipt.save();

  /* ================= LEDGER (SOURCE OF TRUTH) ================= */
  const ledgerEntry = new LedgerEntry({
    type: "PAYMENT",
    amount: payment.amount,
    hospital: payment.hospital,
    patient: payment.patient,
    reference: receiptNo,
    source: payment.method,
  });

  ledgerEntry.$locals.viaWorkflow = true;
  ledgerEntry.$locals.workflowId = workflowId;

  await ledgerEntry.save();

  /* ================= INVOICE ================= */
  if (payment.invoice) {
    const invoice = await Invoice.findById(payment.invoice);
    if (!invoice) throw new Error("Invoice not found");

    invoice.status = "Paid";
    invoice.paidAt = new Date();

    invoice.$locals.viaWorkflow = true;
    invoice.$locals.workflowId = workflowId;

    await invoice.save();
  }

  /* ================= WORKFLOW ================= */
  workflow.state = "COMPLETED";
  workflow.history.push({
    state: "COMPLETED",
    at: new Date(),
    by: actor.id,
  });

  await workflow.save();

  /* ================= AUDIT ================= */
  await logAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: "PAYMENT_FINALIZED",
    resource: "payment",
    resourceId: payment._id,
    hospital: payment.hospital,
    after: {
      receipt: receipt._id,
      amount: payment.amount,
    },
  });

  return receipt;
}
