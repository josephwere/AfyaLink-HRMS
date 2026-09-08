import BillingEvent from "../models/BillingEvent.js";
import Financial from "../models/Financial.js";
import eventPublisher from "./eventPublisher.js";
import { v4 as uuidv4 } from "uuid";

const VALID_TRANSITIONS = {
  DRAFT: ["GENERATED", "VOIDED"],
  GENERATED: ["REVIEWED", "ISSUED", "VOIDED"],
  REVIEWED: ["ISSUED", "VOIDED"],
  ISSUED: ["PARTIALLY_PAID", "PAID", "OVERDUE", "VOIDED"],
  PARTIALLY_PAID: ["PAID", "OVERDUE", "VOIDED"],
  PAID: [],
  OVERDUE: ["PAID", "VOIDED"],
  VOIDED: [],
};

function normalizeStatus(status) {
  return String(status || "DRAFT").toUpperCase();
}

export async function recordInvoiceLifecycleEvent({ invoiceId, eventName, status, payload = {}, actor = null, correlationId = null, causationId = null } = {}) {
  const invoice = await Financial.findById(invoiceId);
  if (!invoice) throw new Error("Invoice not found");

  const currentStatus = normalizeStatus(invoice.lifecycleStatus || "DRAFT");
  const nextStatus = normalizeStatus(status || currentStatus || "DRAFT");

  if (currentStatus && VALID_TRANSITIONS[currentStatus] && !VALID_TRANSITIONS[currentStatus].includes(nextStatus) && nextStatus !== currentStatus) {
    throw new Error(`Invalid invoice transition ${currentStatus} -> ${nextStatus}`);
  }

  invoice.lifecycleStatus = nextStatus;
  await invoice.save();

  const eventDoc = await BillingEvent.create({
    eventId: uuidv4(),
    aggregateId: String(invoice._id),
    aggregateType: "Invoice",
    eventName,
    version: 1,
    payload: { ...payload, invoiceNumber: invoice.invoiceNumber, previousStatus: currentStatus, nextStatus },
    actor,
    correlationId,
    causationId,
  });

  await eventPublisher.publish(eventName, { invoice, event: eventDoc });
  return { invoice, event: eventDoc };
}

export async function transitionInvoice({ invoiceId, eventName, status, payload, actor, correlationId, causationId }) {
  return recordInvoiceLifecycleEvent({ invoiceId, eventName, status, payload, actor, correlationId, causationId });
}

export default { transitionInvoice, recordInvoiceLifecycleEvent };
