import eventPublisher from "./eventPublisher.js";
import { getUsageLedgerEntries } from "./usageLedgerService.js";
import Financial from "../models/Financial.js";
import { generateInvoiceId } from "./idGenerator.js";

function groupLedgerEntries(entries = []) {
  const map = new Map();
  entries.forEach((e) => {
    const key = e.featureCode || e.serviceCode || e.feature || "UNKNOWN";
    const current = map.get(key) || {
      featureCode: key,
      serviceCode: e.serviceCode || key,
      serviceName: e.serviceName || e.featureName || key,
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
      description: row.serviceName,
      amount: Math.round(row.totalAmount * 100) / 100,
      category: row.category,
      quantity: qty,
      unitPrice,
    };
  });
}

export async function regenerateDraftInvoice(hospitalId, invoiceMonth) {
  if (!hospitalId || !invoiceMonth) return null;

  const entries = await getUsageLedgerEntries({ hospitalId, invoiceMonth, status: "POSTED" });
  if (!entries || !entries.length) return null;

  const items = groupLedgerEntries(entries);
  const total = items.reduce((s, it) => s + Number(it.amount || 0), 0);

  // Find existing draft
  const existing = await Financial.findOne({ hospital: hospitalId, "metadata.invoiceMonth": invoiceMonth, status: "Pending" });
  if (existing) {
    existing.items = items;
    existing.total = total;
    existing.metadata = { ...(existing.metadata || {}), invoiceMonth };
    await existing.save();
    try {
      await eventPublisher.publish("InvoiceDrafted", { hospitalId, invoiceMonth, invoice: existing });
    } catch (_e) {}
    return existing;
  }

  const invoiceNumber = await generateInvoiceId();
  const created = await Financial.create({ hospital: hospitalId, invoiceNumber, items, total, status: "Pending", metadata: { invoiceMonth } });
  try {
    await eventPublisher.publish("InvoiceDrafted", { hospitalId, invoiceMonth, invoice: created });
  } catch (_e) {}
  return created;
}

export function startInvoiceAggregationConsumer() {
  eventPublisher.subscribe("LedgerEntryCreated", async ({ ledgerEntry } = {}) => {
    try {
      const hospitalId = ledgerEntry?.hospital;
      const invoiceMonth = ledgerEntry?.invoiceMonth;
      if (hospitalId && invoiceMonth) {
        await regenerateDraftInvoice(hospitalId, invoiceMonth);
      }
    } catch (_e) {
      // swallow
    }
  });
}

export default { regenerateDraftInvoice, startInvoiceAggregationConsumer };
