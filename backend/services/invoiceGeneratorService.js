import Financial from "../models/Financial.js";
import { generateInvoiceId } from "./idGenerator.js";
import { getUsageLedgerEntries } from "./usageLedgerService.js";
import eventPublisher from "./eventPublisher.js";
import { transitionInvoice } from "./billingLifecycleService.js";
import GeneralLedgerService from "./generalLedgerService.js";

function groupLedgerEntries(entries = []) {
  const map = new Map();
  entries.forEach((e) => {
    const key = e.featureCode || e.serviceCode || e.feature || "UNKNOWN";
    const current = map.get(key) || {
      featureCode: key,
      serviceCode: e.serviceCode || key,
      description: e.serviceName || e.featureName || key,
      category: e.category || "",
      totalQuantity: 0,
      totalAmount: 0,
      unitPriceSum: 0,
    };
    current.totalQuantity += Number(e.chargeableQuantity || e.quantity || 0);
    current.totalAmount += Number(e.amount || 0);
    current.unitPriceSum += Number(e.unitPrice || 0) * (Number(e.chargeableQuantity || e.quantity || 0) || 1);
    map.set(key, current);
  });

  return Array.from(map.values()).map((row) => {
    const qty = row.totalQuantity || 0;
    const unitPrice = qty ? Math.round((row.unitPriceSum || 0) / qty * 100) / 100 : 0;
    return {
      featureCode: row.featureCode,
      serviceCode: row.serviceCode,
      description: row.description,
      amount: Math.round(row.totalAmount * 100) / 100,
      category: row.category,
      quantity: qty,
      unitPrice,
    };
  });
}

export async function generateInvoiceFromLedger({ hospitalId, invoiceMonth } = {}) {
  if (!hospitalId || !invoiceMonth) throw new Error("hospitalId and invoiceMonth required");

  const entries = await getUsageLedgerEntries({ hospitalId, invoiceMonth, status: "POSTED" });
  if (!entries || !entries.length) return null;

  const items = groupLedgerEntries(entries);
  const total = items.reduce((s, it) => s + Number(it.amount || 0), 0);

  const invoiceNumber = await generateInvoiceId();

  const doc = await Financial.create({
    hospital: hospitalId,
    invoiceNumber,
    items,
    total,
    status: "Pending",
    lifecycleStatus: "DRAFT",
    metadata: { invoiceMonth },
  });

  await GeneralLedgerService.postEntry({
    entryType: "INVOICE_ISSUED",
    hospitalId: doc.hospital,
    invoiceId: doc._id,
    description: `Invoice ${invoiceNumber} for ${invoiceMonth}`,
    currency: "KES",
    accountingPeriodKey: invoiceMonth,
    lines: [
      { accountCode: "1100", accountName: "Accounts Receivable", direction: "DEBIT", amount: total },
      { accountCode: "4000", accountName: "Revenue", direction: "CREDIT", amount: total },
    ],
    metadata: { invoiceMonth, invoiceNumber, itemCount: items.length },
  });

  try {
    await transitionInvoice({
      invoiceId: doc._id,
      eventName: "InvoiceGenerated",
      status: "GENERATED",
      payload: { hospitalId, invoiceMonth, total, items },
    });
  } catch (_e) {}

  try {
    await eventPublisher.publish("InvoiceGenerated", { hospitalId, invoiceMonth, invoice: doc });
  } catch (_e) {}

  return doc;
}

export default { generateInvoiceFromLedger };
