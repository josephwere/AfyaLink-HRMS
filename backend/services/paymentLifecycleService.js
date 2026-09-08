import BillingEvent from "../models/BillingEvent.js";
import Financial from "../models/Financial.js";
import eventPublisher from "./eventPublisher.js";
import { v4 as uuidv4 } from "uuid";

const VALID_TRANSITIONS = {
  ISSUED: ["VIEWED", "PARTIALLY_PAID", "PAID", "VOIDED", "OVERDUE"],
  VIEWED: ["PARTIALLY_PAID", "PAID", "VOIDED", "OVERDUE"],
  PARTIALLY_PAID: ["PAID", "OVERDUE", "VOIDED"],
  PAID: [],
  OVERDUE: ["PARTIALLY_PAID", "PAID", "VOIDED"],
  VOIDED: [],
};

function normalizeStatus(status) {
  return String(status || "ISSUED").toUpperCase();
}

export async function recordPaymentLifecycleEvent({ invoiceId, eventName, status, payload = {}, actor = null, correlationId = null, causationId = null } = {}) {
  const invoice = await Financial.findById(invoiceId);
  if (!invoice) throw new Error("Invoice not found");

  const currentStatus = normalizeStatus(invoice.paymentLifecycleStatus || "ISSUED");
  const nextStatus = normalizeStatus(status || currentStatus || "ISSUED");

  if (currentStatus && VALID_TRANSITIONS[currentStatus] && !VALID_TRANSITIONS[currentStatus].includes(nextStatus) && nextStatus !== currentStatus) {
    throw new Error(`Invalid payment transition ${currentStatus} -> ${nextStatus}`);
  }

  invoice.paymentLifecycleStatus = nextStatus;
  await invoice.save();

  const eventDoc = await BillingEvent.create({
    eventId: uuidv4(),
    aggregateId: String(invoice._id),
    aggregateType: "Invoice",
    eventName,
    version: 1,
    payload: { ...payload, previousStatus: currentStatus, nextStatus },
    actor,
    correlationId,
    causationId,
  });

  await eventPublisher.publish(eventName, { invoice, event: eventDoc });
  return { invoice, event: eventDoc };
}

export async function transitionPayment({ invoiceId, eventName, status, payload, actor, correlationId, causationId }) {
  return recordPaymentLifecycleEvent({ invoiceId, eventName, status, payload, actor, correlationId, causationId });
}

export default { transitionPayment, recordPaymentLifecycleEvent };
