import crypto from "node:crypto";
import PharmacyRecall from "../models/PharmacyRecall.js";
import PharmacyBatchControl from "../models/PharmacyBatchControl.js";
import PharmacyGoodsReceipt from "../models/PharmacyGoodsReceipt.js";
import PharmacyInventoryMovement from "../models/PharmacyInventoryMovement.js";
import PharmacyBatchDisposition from "../models/PharmacyBatchDisposition.js";
import PharmacyRecallDiscrepancy from "../models/PharmacyRecallDiscrepancy.js";
import PharmacyItem from "../models/PharmacyItem.js";
import PharmacyPurchaseOrder from "../models/PharmacyPurchaseOrder.js";
import PharmacyShipment from "../models/PharmacyShipment.js";

const sum = (rows, field = "quantity") => rows.reduce((total, row) => total + (Number(row[field]) || 0), 0);
const hash = (value) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function recallFilter(recall) {
  const filter = {};
  if (recall.regulatoryProduct) filter.regulatoryProduct = recall.regulatoryProduct;
  if (recall.batchNumber) filter.batchNumber = recall.batchNumber;
  return filter;
}

export async function deriveRecallReconciliation(recall) {
  const controls = await PharmacyBatchControl.find(recallFilter(recall)).lean();
  const itemIds = controls.map((control) => control.itemId).filter(Boolean);
  const batchNumbers = [...new Set(controls.map((control) => control.batchNumber).filter(Boolean))];
  const purchaseOrderIds = controls.map((control) => control.purchaseOrder).filter(Boolean);
  const [receipts, movements, dispositions, items, discrepancies, shipments, purchaseOrders] = await Promise.all([
    PharmacyGoodsReceipt.find({ hospital: { $in: controls.map((control) => control.hospital) }, "items.itemId": { $in: itemIds } }).lean(),
    PharmacyInventoryMovement.find({ itemId: { $in: itemIds }, batchNumber: { $in: batchNumbers } }).sort({ createdAt: 1 }).lean(),
    PharmacyBatchDisposition.find({ itemId: { $in: itemIds }, batchNumber: { $in: batchNumbers } }).sort({ createdAt: 1 }).lean(),
    PharmacyItem.find({ _id: { $in: itemIds }, hospital: { $in: controls.map((control) => control.hospital) } }).select("hospital batches").lean(),
    PharmacyRecallDiscrepancy.find({ recallId: recall._id }).lean(),
    PharmacyShipment.find({ purchaseOrder: { $in: purchaseOrderIds } }).lean(),
    PharmacyPurchaseOrder.find({ _id: { $in: purchaseOrderIds } }).lean(),
  ]);

  const byControl = controls.map((control) => {
    const hospital = String(control.hospital);
    const itemId = String(control.itemId);
    const batchNumber = String(control.batchNumber);
    const controlReceipts = receipts.flatMap((receipt) => receipt.items.filter((item) => String(receipt.hospital) === hospital && String(item.itemId) === itemId && (!batchNumber || item.batchNumber === batchNumber)));
    const controlMovements = movements.filter((movement) => String(movement.hospital) === hospital && String(movement.itemId) === itemId && movement.batchNumber === batchNumber);
    const controlDispositions = dispositions.filter((disposition) => String(disposition.hospital) === hospital && String(disposition.itemId) === itemId && disposition.batchNumber === batchNumber);
    const physicalItem = items.find((item) => String(item.hospital) === hospital && String(item._id) === itemId);
    const physicalBatch = physicalItem?.batches?.find((batch) => batch.batchNumber === batchNumber);
    const received = sum(controlReceipts, "receivedQuantity") || sum(controlMovements.filter((movement) => movement.movementType === "RECEIPT"));
    const dispensed = sum(controlMovements.filter((movement) => movement.movementType === "DISPENSE"));
    const transferred = sum(controlDispositions.filter((entry) => entry.disposition === "TRANSFERRED"));
    const returned = sum(controlDispositions.filter((entry) => entry.disposition === "RETURNED"));
    const destroyed = sum(controlDispositions.filter((entry) => entry.disposition === "DESTROYED"));
    const expectedQuantity = Math.max(0, received - dispensed - transferred - returned - destroyed);
    const confirmedQuantity = Math.max(0, Number(physicalBatch?.quantity) || 0);
    const missingQuantity = Math.max(0, expectedQuantity - confirmedQuantity);
    const overageQuantity = Math.max(0, confirmedQuantity - expectedQuantity);
    const related = discrepancies.filter((entry) => String(entry.hospital) === hospital && String(entry.itemId) === itemId && entry.batchNumber === batchNumber);
    const unresolved = related.some((entry) => entry.status !== "RESOLVED");
    const reconciliationStatus = missingQuantity || overageQuantity ? (unresolved ? "DISCREPANCY_OPEN" : "DISCREPANCY_UNRESOLVED") : "RECONCILED";
    return { batchId: batchNumber, hospital: control.hospital, itemId: control.itemId, received, expectedQuantity, confirmedQuantity, dispensed, transferred, returned, destroyed, missingQuantity, overageQuantity, reconciliationStatus, sourceRefs: { controlId: control._id, receiptIds: controlReceipts.map((row) => row._id), movementIds: controlMovements.map((row) => row._id), dispositionIds: controlDispositions.map((row) => row._id) } };
  });

  const totals = byControl.reduce((total, row) => {
    for (const key of ["received", "expectedQuantity", "confirmedQuantity", "dispensed", "transferred", "returned", "destroyed", "missingQuantity", "overageQuantity"]) total[key] += row[key];
    return total;
  }, { received: 0, expectedQuantity: 0, confirmedQuantity: 0, dispensed: 0, transferred: 0, returned: 0, destroyed: 0, missingQuantity: 0, overageQuantity: 0 });
  const affectedHospitals = [...new Set(byControl.map((row) => String(row.hospital)))];
  const acknowledgedHospitals = (recall.hospitalAcknowledgements || []).map((entry) => String(entry.hospital));
  const unrespondedHospitals = affectedHospitals.filter((hospital) => !acknowledgedHospitals.includes(hospital) && !(recall.hospitalReconciliations || []).some((entry) => String(entry.hospital) === hospital && entry.escalated));
  const missingEdges = [];
  for (const control of controls) {
    const order = purchaseOrders.find((entry) => String(entry._id) === String(control.purchaseOrder));
    const shipment = shipments.find((entry) => String(entry.purchaseOrder) === String(control.purchaseOrder));
    const shipmentBatch = shipment?.items?.some((entry) => String(entry.itemId) === String(control.itemId) && (!control.batchNumber || entry.batchNumber === control.batchNumber));
    if (!control.supplier || !control.purchaseOrder || !order || String(order.supplier) !== String(control.supplier)) missingEdges.push({ edge: "supplier -> PO", controlId: control._id });
    if (!order || !shipment) missingEdges.push({ edge: "PO -> shipment", controlId: control._id });
    if (!shipmentBatch) missingEdges.push({ edge: "shipment -> batch", controlId: control._id });
    if (!control.hospital) missingEdges.push({ edge: "batch -> hospital", controlId: control._id });
    if (!items.some((item) => String(item._id) === String(control.itemId) && String(item.hospital) === String(control.hospital))) missingEdges.push({ edge: "hospital -> inventory", controlId: control._id });
    if (!movements.some((movement) => String(movement.itemId) === String(control.itemId) && String(movement.hospital) === String(control.hospital) && movement.batchNumber === control.batchNumber)) missingEdges.push({ edge: "inventory -> disposition", controlId: control._id });
  }
  const traceStatus = missingEdges.length ? (missingEdges.length >= controls.length * 3 ? "TRACE_BROKEN" : "TRACE_PARTIAL") : "TRACE_COMPLETE";
  return { recallId: recall._id, rows: byControl, totals, controls, receipts, movements, dispositions, discrepancies, shipments, purchaseOrders, affectedHospitals, unrespondedHospitals, missingEdges, traceStatus, completeness: byControl.length > 0 && byControl.every((row) => row.reconciliationStatus === "RECONCILED") ? "TRACE_COMPLETE" : byControl.length ? "TRACE_PARTIAL" : "TRACE_BROKEN" };
}

export async function upsertDerivedDiscrepancies(recall) {
  const report = await deriveRecallReconciliation(recall);
  for (const row of report.rows.filter((entry) => entry.missingQuantity > 0 || entry.overageQuantity > 0)) {
    const severity = row.missingQuantity >= 10 || row.overageQuantity >= 10 ? "CRITICAL" : "HIGH";
    await PharmacyRecallDiscrepancy.findOneAndUpdate(
      { recallId: recall._id, hospital: row.hospital, itemId: row.itemId, batchNumber: row.batchId, status: { $ne: "RESOLVED" } },
      { $set: { batchId: row.batchId, expectedQuantity: row.expectedQuantity, confirmedQuantity: row.confirmedQuantity, received: row.received, held: row.confirmedQuantity, dispensed: row.dispensed, transferred: row.transferred, returned: row.returned, destroyed: row.destroyed, missingQuantity: row.missingQuantity, overageQuantity: row.overageQuantity, severity, reason: "Authoritative quantity does not match physical reconciliation", sourceRefs: [row.sourceRefs], correlationId: String(recall._id) }, $setOnInsert: { recallId: recall._id, hospital: row.hospital, itemId: row.itemId, batchNumber: row.batchId, status: "OPEN", createdBy: recall.createdBy } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
  return deriveRecallReconciliation(recall);
}

export function closureDecision(report) {
  const unresolved = report.discrepancies.filter((entry) => entry.status !== "RESOLVED");
  const reasons = [];
  if (report.completeness !== "TRACE_COMPLETE") reasons.push("TRACE_INCOMPLETE");
  if (report.unrespondedHospitals.length) reasons.push("HOSPITALS_NOT_RESPONDED");
  if (report.rows.some((row) => row.confirmedQuantity > 0 && row.reconciliationStatus !== "RECONCILED")) reasons.push("INVENTORY_NOT_RECONCILED");
  if (unresolved.length) reasons.push("UNRESOLVED_DISCREPANCIES");
  if (unresolved.some((entry) => entry.severity === "CRITICAL")) reasons.push("CRITICAL_DISCREPANCY_OPEN");
  return { allowed: reasons.length === 0, code: reasons.length ? "RECALL_CLOSURE_BLOCKED" : "RECALL_CLOSURE_READY", reasons, report };
}

export async function buildRecallEvidencePackage(recall) {
  const report = await deriveRecallReconciliation(recall);
  const canonical = { recall, controls: report.controls, purchaseOrders: report.purchaseOrders, shipments: report.shipments, receipts: report.receipts, movements: report.movements, dispositions: report.dispositions, discrepancies: report.discrepancies, reconciliation: { rows: report.rows, totals: report.totals, completeness: report.completeness } };
  return { ...canonical, generatedAt: new Date().toISOString(), evidenceHash: hash(canonical), recordCounts: Object.fromEntries(Object.entries(canonical).filter(([, value]) => Array.isArray(value)).map(([key, value]) => [key, value.length])), completeness: report.completeness };
}
