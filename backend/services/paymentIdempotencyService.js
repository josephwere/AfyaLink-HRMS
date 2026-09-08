import mongoose from "mongoose";
import PaymentReceipt from "../models/PaymentReceipt.js";
import Financial from "../models/Financial.js";
import OutboxEvent from "../models/OutboxEvent.js";
import { transitionPayment } from "./paymentLifecycleService.js";
import GeneralLedgerService from "./generalLedgerService.js";

export async function processPaymentWithIdempotency({
  invoiceId,
  amount,
  method,
  idempotencyKey,
  providerTransactionId = null,
  provider = "UNKNOWN",
  metadata = {},
  actor = null,
  correlationId = null,
  causationId = null,
} = {}) {
  if (!invoiceId) throw new Error("invoiceId is required");
  if (!idempotencyKey && !providerTransactionId) throw new Error("idempotencyKey or providerTransactionId is required");

  const key = idempotencyKey || providerTransactionId;

  const existing = await PaymentReceipt.findOne({
    $or: [{ idempotencyKey: key }, { providerTransactionId: providerTransactionId || null }],
  });

  if (existing) {
    return { duplicate: true, receipt: existing };
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const invoice = await Financial.findById(invoiceId).session(session);
    if (!invoice) throw new Error("Invoice not found");

    const receipt = await PaymentReceipt.create([{
      invoiceId,
      hospitalId: invoice.hospital,
      amount,
      currency: invoice.currency || "KES",
      method,
      provider,
      providerTransactionId,
      idempotencyKey: key,
      status: "PROCESSED",
      metadata,
      receivedAt: new Date(),
    }], { session });

    await GeneralLedgerService.postEntry({
      entryType: "PAYMENT_RECEIVED",
      hospitalId: invoice.hospital,
      invoiceId,
      paymentReceiptId: receipt[0]._id,
      description: `Payment received for invoice ${invoice.invoiceNumber}`,
      currency: invoice.currency || "KES",
      accountingPeriodKey: invoice.metadata?.invoiceMonth || new Date().toISOString().slice(0, 7),
      lines: [
        { accountCode: "1000", accountName: "Cash", direction: "DEBIT", amount },
        { accountCode: "1100", accountName: "Accounts Receivable", direction: "CREDIT", amount },
      ],
      metadata: { provider, providerTransactionId, idempotencyKey: key },
    });

    await transitionPayment({
      invoiceId,
      eventName: "InvoicePaid",
      status: "PAID",
      payload: { amount, provider, providerTransactionId, idempotencyKey: key },
      actor,
      correlationId,
      causationId,
    });

    await OutboxEvent.create([{
      aggregateId: String(invoiceId),
      aggregateType: "Invoice",
      eventName: "PaymentReceived",
      payload: { amount, provider, providerTransactionId, idempotencyKey: key, invoiceId },
      status: "PENDING",
    }], { session });

    await session.commitTransaction();
    session.endSession();
    return { duplicate: false, receipt: receipt[0] };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
}

export default { processPaymentWithIdempotency };
