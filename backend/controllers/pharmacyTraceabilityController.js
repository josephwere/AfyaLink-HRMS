import PharmacyItem from "../models/PharmacyItem.js";
import PharmacySupplier from "../models/PharmacySupplier.js";
import SupplierLicense from "../models/SupplierLicense.js";
import RegulatoryProduct from "../models/RegulatoryProduct.js";
import PharmacyBatchControl from "../models/PharmacyBatchControl.js";
import PharmacyVerificationEvent from "../models/PharmacyVerificationEvent.js";
import PharmacyRecall from "../models/PharmacyRecall.js";
import PharmacyRecallDiscrepancy from "../models/PharmacyRecallDiscrepancy.js";
import PharmacyPurchaseOrder from "../models/PharmacyPurchaseOrder.js";
import PharmacyGoodsReceipt from "../models/PharmacyGoodsReceipt.js";
import PharmacyInventoryMovement from "../models/PharmacyInventoryMovement.js";
import PharmacyBatchDisposition from "../models/PharmacyBatchDisposition.js";
import MedicineSafetySignal from "../models/MedicineSafetySignal.js";
import { notifyRolesInHospital } from "../services/notificationService.js";
import { normalizeRole } from "../utils/normalizeRole.js";
import { appendComplianceLedger } from "../utils/complianceLedger.js";
import { parseScanPayload, verifyProductEvidence } from "../services/pharmacyRegulatoryProvider.js";
import crypto from "node:crypto";
import { evaluateVerificationEvent, evaluateRecall, buildEvidencePackage, assertAiCannotDecide } from "../services/medicineSafetyIntelligence.js";
import { deriveRecallReconciliation, upsertDerivedDiscrepancies, closureDecision, buildRecallEvidencePackage, recallFilter } from "../services/pharmacyRecallReconciliationService.js";

const REGULATOR_ROLES = ["GOVERNMENT_REGULATOR", "GOVERNMENT_ADMIN", "GOVERNMENT_AUDITOR", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"];

function hospitalFor(req) {
  const role = normalizeRole(req.user?.role);
  if (req.query?.hospitalId && REGULATOR_ROLES.includes(role)) return req.query.hospitalId;
  return req.user?.hospital || req.user?.hospitalId || null;
}

function requireHospital(req, res) {
  const hospital = hospitalFor(req);
  if (!hospital) {
    res.status(400).json({ msg: "Hospital scope required" });
    return null;
  }
  return hospital;
}

function isRegulator(req) {
  return REGULATOR_ROLES.includes(normalizeRole(req.user?.role));
}

function correlationId(req) {
  return String(req.headers?.["x-correlation-id"] || crypto.randomUUID());
}

const RECALL_LIFECYCLE = {
  DRAFT: ["ACTIVE", "CLOSED"],
  ACTIVE: ["CONTAINMENT", "CLOSED"],
  CONTAINMENT: ["RECONCILIATION", "CLOSED"],
  RECONCILIATION: ["CLOSED"],
  OPEN: ["UNDER_INVESTIGATION", "CLOSED"],
  UNDER_INVESTIGATION: ["CLOSED"],
  CLOSED: [],
};

function normalizeRecallStatus(status) {
  const value = String(status || "").toUpperCase();
  if (["DRAFT", "ACTIVE", "CONTAINMENT", "RECONCILIATION", "CLOSED", "OPEN", "UNDER_INVESTIGATION"].includes(value)) return value;
  return "DRAFT";
}

async function reconcileRecallState(recallId, actorId = null) {
  const recall = await PharmacyRecall.findById(recallId).lean();
  if (!recall) return null;
  const discrepancies = await PharmacyRecallDiscrepancy.find({ recallId: recall._id, status: { $ne: "RESOLVED" } }).lean();
  const resolution = { total: discrepancies.length, open: discrepancies.filter((entry) => entry.status !== "RESOLVED").length, unresolved: discrepancies.filter((entry) => entry.missingQuantity > 0 || entry.status !== "RESOLVED").length };

  const overallTrace = await collectRecallTraceSummary(recall);
  const completeness = Math.min(100, Math.max(0, Math.round(overallTrace.completeness * 100)));
  const pending = resolution.unresolved > 0 || completeness < 100;

  const update = {
    traceCompleteness: completeness,
    discrepancyCount: resolution.total,
    unresolvedDiscrepancies: resolution.unresolved,
    reconciliationSummary: { ...overallTrace, pending, lastUpdatedAt: new Date().toISOString() },
  };

  if (recall.status === "RECONCILIATION" && !pending && actorId) {
    update.status = "CLOSED";
    update.closedAt = new Date();
    update.closedBy = actorId;
    update.closureEvidence = { evidenceHash: crypto.createHash("sha256").update(JSON.stringify({ recallId: recall._id, completeness, discrepancies })).digest("hex"), completeness, discrepancies: resolution.total, closedAt: new Date().toISOString() };
  }

  const updated = await PharmacyRecall.findByIdAndUpdate(recallId, { $set: update }, { new: true });
  return updated;
}

async function collectRecallTraceSummary(recall) {
  const batchNumber = recall.batchNumber || "";
  const filters = {};
  if (recall.regulatoryProduct) filters.regulatoryProduct = recall.regulatoryProduct;
  if (batchNumber) filters.batchNumber = batchNumber;
  const controls = await PharmacyBatchControl.find(filters).select("hospital itemId batchNumber status verificationStatus").lean();
  const itemIds = [...new Set(controls.map((control) => String(control.itemId)))];
  const hospitalIds = [...new Set(controls.map((control) => String(control.hospital)))];
  const movements = await PharmacyInventoryMovement.find({ itemId: { $in: itemIds }, batchNumber }).select("movementType quantity previousQuantity newQuantity").lean();
  const dispositions = await PharmacyBatchDisposition.find({ batchNumber }).select("disposition quantity destinationHospital").lean();
  const totalAffected = controls.length || 1;
  const accounted = new Set(movements.map((movement) => `${movement.itemId}-${movement.batchNumber}-${movement.movementType}`));
  const dispositionCount = dispositions.length;
  const completeness = Math.min(100, Math.max(0, Math.round(((controls.length + (accounted.size > 0 ? 1 : 0) + dispositionCount) / Math.max(3, totalAffected + 2)) * 100)));
  return {
    affectedControls: controls.length,
    affectedHospitals: hospitalIds.length,
    movements: movements.length,
    dispositions: dispositionCount,
    completeness,
    trackedStates: controls.map((control) => ({ hospital: control.hospital, batchNumber: control.batchNumber, status: control.status, verificationStatus: control.verificationStatus })),
  };
}

export async function createRegulatoryProduct(req, res) {
  try {
    if (!isRegulator(req)) return res.status(403).json({ msg: "Regulator access required" });
    const product = await RegulatoryProduct.create({ ...req.body, updatedBy: req.user?._id });
    await appendComplianceLedger({ actorId: req.user?._id, actorRole: normalizeRole(req.user?.role), action: "REGULATORY_PRODUCT_REGISTERED", resource: "regulatory_product", resourceId: product._id, metadata: { registrationNumber: product.registrationNumber, authority: product.authority } });
    res.status(201).json(product);
  } catch (err) {
    console.error("Regulatory product create error:", err);
    res.status(500).json({ msg: "Failed to register product" });
  }
}

export async function updateRegulatoryProduct(req, res) {
  try {
    if (!isRegulator(req)) return res.status(403).json({ msg: "Regulator access required" });
    const status = String(req.body?.status || "").toUpperCase();
    if (!["ACTIVE", "SUSPENDED", "RECALLED", "EXPIRED"].includes(status)) return res.status(400).json({ msg: "Invalid regulatory product status" });
    const product = await RegulatoryProduct.findByIdAndUpdate(req.params.id, { $set: { status, updatedBy: req.user?._id } }, { new: true });
    if (!product) return res.status(404).json({ msg: "Regulatory product not found" });
    await appendComplianceLedger({ actorId: req.user?._id, actorRole: normalizeRole(req.user?.role), action: `REGULATORY_PRODUCT_${status}`, resource: "regulatory_product", resourceId: product._id, metadata: { registrationNumber: product.registrationNumber } });
    res.json(product);
  } catch (err) {
    console.error("Regulatory product update error:", err);
    res.status(500).json({ msg: "Failed to update regulatory product" });
  }
}

export async function listRegulatoryProducts(req, res) {
  try {
    const filter = {};
    if (req.query?.status) filter.status = String(req.query.status).toUpperCase();
    if (req.query?.q) filter.$or = [{ registrationNumber: { $regex: req.query.q, $options: "i" } }, { tradeName: { $regex: req.query.q, $options: "i" } }, { manufacturer: { $regex: req.query.q, $options: "i" } }];
    const products = await RegulatoryProduct.find(filter).sort({ tradeName: 1 }).limit(500).lean();
    res.json({ products });
  } catch (err) {
    console.error("Regulatory product list error:", err);
    res.status(500).json({ msg: "Failed to load regulatory products" });
  }
}

export async function upsertSupplierLicense(req, res) {
  try {
    const supplierId = normalizeRole(req.user?.role) === "SUPPLIER" ? req.user?.supplier : req.body?.supplierId;
    if (!supplierId) return res.status(400).json({ msg: "Supplier scope required" });
    if (!isRegulator(req) && normalizeRole(req.user?.role) !== "SUPPLIER") return res.status(403).json({ msg: "Supplier or regulator access required" });
    const license = await SupplierLicense.findOneAndUpdate(
      { supplier: supplierId },
      { $set: { licenseNumber: req.body?.licenseNumber, authority: req.body?.authority || "PPB", status: String(req.body?.status || "ACTIVE").toUpperCase(), expiresAt: req.body?.expiresAt, verifiedAt: isRegulator(req) ? new Date() : null, verifiedBy: isRegulator(req) ? req.user?._id : null } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.status(200).json(license);
  } catch (err) {
    console.error("Supplier license error:", err);
    res.status(500).json({ msg: "Failed to save supplier license" });
  }
}

export async function verifyIncomingBatch({ hospital, itemId, batchNumber, supplierId, purchaseOrderId, registrationNumber, manufacturer, expiryDate, scannedCode, scanMethod = "MANUAL", scannedBy, location = "", correlationId: eventCorrelationId = crypto.randomUUID() }) {
  const scan = parseScanPayload(scannedCode);
  const resolvedBatchNumber = batchNumber || scan.batchNumber;
  const resolvedExpiryDate = expiryDate || scan.expiryDate;
  const evidence = await verifyProductEvidence({ registrationNumber });
  const product = evidence.product;
  const riskSignals = [];
  const item = await PharmacyItem.findOne({ _id: itemId, hospital }).lean();
  if (!item) riskSignals.push("ITEM_NOT_FOUND");
  if (!product) riskSignals.push("REGISTRATION_NOT_FOUND");
  if (product?.status !== "ACTIVE") riskSignals.push(`REGULATORY_STATUS_${product?.status || "UNKNOWN"}`);
  if (supplierId) {
    const supplier = await PharmacySupplier.findById(supplierId).select("regulatoryStatus active").lean();
    if (!supplier || supplier.active === false || ["SUSPENDED", "REVOKED"].includes(supplier.regulatoryStatus)) riskSignals.push("SUPPLIER_REGULATORY_STATUS_INVALID");
  }
  if (product?.registrationExpiresAt && new Date(product.registrationExpiresAt) < new Date()) riskSignals.push("REGISTRATION_EXPIRED");
  if (product && manufacturer && product.manufacturer.trim().toLowerCase() !== manufacturer.trim().toLowerCase()) riskSignals.push("MANUFACTURER_MISMATCH");
  if (resolvedExpiryDate && new Date(resolvedExpiryDate) <= new Date()) riskSignals.push("PRODUCT_EXPIRED");
  const license = supplierId ? await SupplierLicense.findOne({ supplier: supplierId }).lean() : null;
  if (!license || license.status !== "ACTIVE" || (license.expiresAt && new Date(license.expiresAt) < new Date())) riskSignals.push("SUPPLIER_LICENSE_INVALID");
  const recalled = await PharmacyRecall.exists({ $or: [{ registrationNumber: registrationNumber || "" }, { regulatoryProduct: product?._id }], batchNumber: resolvedBatchNumber, status: { $in: ["ACTIVE", "CONTAINMENT", "RECONCILIATION", "OPEN", "UNDER_INVESTIGATION"] } });
  if (recalled) riskSignals.push("BATCH_RECALLED");
  const result = riskSignals.length ? "QUARANTINED" : "VERIFIED";
  const control = await PharmacyBatchControl.findOneAndUpdate(
    { hospital, itemId, batchNumber: resolvedBatchNumber },
    { $set: { supplier: supplierId || null, regulatoryProduct: product?._id || null, purchaseOrder: purchaseOrderId || null, status: result === "VERIFIED" ? "ACTIVE" : "QUARANTINED", verificationStatus: result, authenticityScore: result === "VERIFIED" ? 100 : Math.max(0, 100 - riskSignals.length * 20), evidenceSource: evidence.source, evidenceHash: evidence.evidenceHash, reason: riskSignals.join(", "), updatedBy: scannedBy, quarantinedAt: result === "VERIFIED" ? null : new Date() } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  const event = await PharmacyVerificationEvent.create({ hospital, itemId, batchNumber: resolvedBatchNumber, supplier: supplierId || null, purchaseOrder: purchaseOrderId || null, registrationNumber: registrationNumber || "", scannedCode: scannedCode || "", scanMethod: scanMethod === "CAMERA" ? "CAMERA" : scanMethod === "SCANNER" ? "SCANNER" : scannedCode ? "IMPORT" : "MANUAL", evidenceSource: evidence.source, evidenceHash: evidence.evidenceHash, provider: evidence.provider, providerRequestId: evidence.requestId, providerResponseStatus: evidence.responseStatus, verificationTimestamp: evidence.verifiedAt, result, riskSignals, evidence: { manufacturer, expiryDate: resolvedExpiryDate, scan, providerError: evidence.providerError || "" }, scannedBy, location, correlationId: eventCorrelationId });
  await evaluateVerificationEvent(event);
  await appendComplianceLedger({ actorId: scannedBy, actorRole: "PHARMACIST", action: result === "VERIFIED" ? "BATCH_VERIFIED" : "BATCH_QUARANTINED", resource: "pharmacy_batch", resourceId: control._id, hospital, metadata: { evidence: riskSignals.length ? riskSignals : ["PRODUCT_REGISTERED", "SUPPLIER_LICENSE_VALID", "NO_ACTIVE_RECALL"], decision: result === "VERIFIED" ? "VERIFY" : "QUARANTINE", verificationEventId: event._id, correlationId: eventCorrelationId } });
  return { result, riskSignals, control, event, product, item };
}

export async function verifyBatch(req, res) {
  try {
    const hospital = requireHospital(req, res);
    if (!hospital) return;
    const verification = await verifyIncomingBatch({ hospital, ...req.body, scannedBy: req.user?._id, correlationId: correlationId(req) });
    if (verification.result !== "VERIFIED") {
      await notifyRolesInHospital({ hospital, roles: ["PHARMACIST", "HOSPITAL_ADMIN"], title: "Medicine batch quarantined", body: `Batch ${req.body?.batchNumber || "unknown"} failed trust verification: ${verification.riskSignals.join(", ")}.`, category: "PHARMACY_SAFETY", meta: { type: "PHARMACY_BATCH_QUARANTINED", controlId: verification.control._id } });
      return res.status(422).json(verification);
    }
    res.json(verification);
  } catch (err) {
    console.error("Batch verification error:", err);
    res.status(500).json({ msg: "Failed to verify medicine batch" });
  }
}

export async function listBatchControls(req, res) {
  try {
    const hospital = requireHospital(req, res);
    if (!hospital) return;
    const controls = await PharmacyBatchControl.find({ hospital }).populate("regulatoryProduct", "registrationNumber tradeName manufacturer").populate("supplier", "name").sort({ updatedAt: -1 }).limit(500).lean();
    res.json({ controls });
  } catch (err) {
    console.error("Batch control list error:", err);
    res.status(500).json({ msg: "Failed to load batch controls" });
  }
}

export async function releaseBatch(req, res) {
  try {
    const hospital = requireHospital(req, res);
    if (!hospital) return;
    const control = await PharmacyBatchControl.findOneAndUpdate({ _id: req.params.id, hospital, status: "QUARANTINED" }, { $set: { status: "RELEASED", verificationStatus: "VERIFIED", reason: req.body?.reason || "Released after review", releasedAt: new Date(), updatedBy: req.user?._id } }, { new: true });
    if (!control) return res.status(404).json({ msg: "Quarantined batch not found" });
    await appendComplianceLedger({ actorId: req.user?._id, actorRole: normalizeRole(req.user?.role), action: "BATCH_RELEASED", resource: "pharmacy_batch", resourceId: control._id, hospital, metadata: { evidence: req.body?.evidence || ["DOCUMENTED_HUMAN_REVIEW"], decision: "RELEASE" } });
    res.json(control);
  } catch (err) {
    console.error("Batch release error:", err);
    res.status(500).json({ msg: "Failed to release batch" });
  }
}

export async function createRecall(req, res) {
  try {
    if (!isRegulator(req)) return res.status(403).json({ msg: "Regulator access required" });
    const existingRecall = await PharmacyRecall.findOne({ registrationNumber: req.body?.registrationNumber || "", batchNumber: req.body?.batchNumber || "", status: { $in: ["DRAFT", "ACTIVE", "CONTAINMENT", "RECONCILIATION", "OPEN", "UNDER_INVESTIGATION"] } }).lean();
    if (existingRecall) return res.status(200).json({ recall: existingRecall, affectedBatches: 0, idempotent: true });
    const recall = await PharmacyRecall.create({ ...req.body, status: normalizeRecallStatus(req.body?.status || "ACTIVE"), createdBy: req.user?._id });
    const filter = recallFilter(recall);
    const controls = await PharmacyBatchControl.find(filter).select("_id hospital itemId batchNumber").lean();
    await PharmacyBatchControl.updateMany(filter, { $set: { status: "RECALLED", verificationStatus: "QUARANTINED", reason: recall.reason, authorityReference: recall.authorityReference, updatedBy: req.user?._id } });
    await Promise.all(controls.map((control) => PharmacyItem.updateOne({ _id: control.itemId, hospital: control.hospital, "batches.batchNumber": recall.batchNumber }, { $set: { "batches.$.verificationStatus": "RECALLED" } })));
    await appendComplianceLedger({ actorId: req.user?._id, actorRole: normalizeRole(req.user?.role), action: "BATCH_RECALL_ISSUED", resource: "pharmacy_recall", resourceId: recall._id, metadata: { authority: recall.authority, authorityReference: recall.authorityReference, batchNumber: recall.batchNumber, registrationNumber: recall.registrationNumber } });
    await evaluateRecall(recall, controls);
    await upsertDerivedDiscrepancies(recall);
    await Promise.all([...new Set(controls.map((control) => String(control.hospital)))].map((hospital) => notifyRolesInHospital({ hospital, roles: ["PHARMACIST", "HOSPITAL_ADMIN"], title: "Urgent medicine recall", body: `Batch ${recall.batchNumber || recall.registrationNumber} is recalled. Stop dispensing and quarantine stock.`, category: "PHARMACY_SAFETY", meta: { type: "PHARMACY_RECALL", recallId: recall._id, batchId: recall.batchNumber || recall.regulatoryProduct } })));
    res.status(201).json({ recall, affectedBatches: controls.length });
  } catch (err) {
    console.error("Recall create error:", err);
    res.status(500).json({ msg: "Failed to create recall" });
  }
}

export async function listRecalls(req, res) {
  try {
    if (!isRegulator(req)) return res.status(403).json({ msg: "Regulator access required" });
    const recalls = await PharmacyRecall.find({}).sort({ createdAt: -1 }).limit(500).lean();
    res.json({ recalls });
  } catch (err) {
    console.error("Recall list error:", err);
    res.status(500).json({ msg: "Failed to load recalls" });
  }
}

export async function getRecallReconciliation(req, res) {
  try {
    if (!isRegulator(req)) return res.status(403).json({ msg: "Regulator access required" });
    const recall = await PharmacyRecall.findById(req.params.id).lean();
    if (!recall) return res.status(404).json({ msg: "Recall not found" });
    const report = await upsertDerivedDiscrepancies(recall);
    res.json({ recall, ...report, closure: closureDecision(report) });
  } catch (err) {
    console.error("Recall reconciliation error:", err);
    res.status(500).json({ msg: "Failed to reconcile recall" });
  }
}

export async function getRecallEvidence(req, res) {
  try {
    if (!isRegulator(req)) return res.status(403).json({ msg: "Regulator access required" });
    const recall = await PharmacyRecall.findById(req.params.id).lean();
    if (!recall) return res.status(404).json({ msg: "Recall not found" });
    res.json(await buildRecallEvidencePackage(recall));
  } catch (err) {
    console.error("Recall evidence error:", err);
    res.status(500).json({ msg: "Failed to build recall evidence" });
  }
}

export async function getNationalRecallReconciliation(req, res) {
  try {
    if (!isRegulator(req)) return res.status(403).json({ msg: "Regulator access required" });
    const recalls = await PharmacyRecall.find({ status: { $ne: "CLOSED" } }).sort({ createdAt: -1 }).limit(500).lean();
    const reports = await Promise.all(recalls.map((recall) => upsertDerivedDiscrepancies(recall)));
    const aggregate = reports.reduce((total, report) => {
      for (const key of ["received", "confirmedQuantity", "dispensed", "transferred", "returned", "destroyed", "missingQuantity", "overageQuantity"]) total[key] += report.totals[key];
      total.suppliers += new Set(report.controls.map((control) => String(control.supplier)).filter(Boolean)).size;
      total.products += new Set(report.controls.map((control) => String(control.regulatoryProduct)).filter(Boolean)).size;
      total.batches += report.rows.length;
      total.hospitals += report.affectedHospitals.length;
      total.unresolvedDiscrepancies += report.discrepancies.filter((entry) => entry.status !== "RESOLVED").length;
      total.hospitalsNotResponded.push(...report.unrespondedHospitals);
      total.completeRecalls += report.completeness === "TRACE_COMPLETE" && !report.unrespondedHospitals.length ? 1 : 0;
      return total;
    }, { suppliers: 0, products: 0, batches: 0, hospitals: 0, received: 0, confirmedQuantity: 0, dispensed: 0, transferred: 0, returned: 0, destroyed: 0, missingQuantity: 0, overageQuantity: 0, unresolvedDiscrepancies: 0, hospitalsNotResponded: [], completeRecalls: 0 });
    aggregate.hospitalsNotResponded = [...new Set(aggregate.hospitalsNotResponded)];
    res.json({ recalls, aggregate: { ...aggregate, reconciliationCompletionPercentage: reports.length ? Math.round((aggregate.completeRecalls / reports.length) * 100) : 100 } });
  } catch (err) {
    console.error("National recall reconciliation error:", err);
    res.status(500).json({ msg: "Failed to load national recall reconciliation" });
  }
}

export async function acknowledgeRecall(req, res) {
  try {
    const hospital = requireHospital(req, res);
    if (!hospital) return;
    const recall = await PharmacyRecall.findById(req.params.id);
    if (!recall) return res.status(404).json({ msg: "Recall not found" });
    const acknowledgements = Array.isArray(recall.hospitalAcknowledgements) ? recall.hospitalAcknowledgements : [];
    const existing = acknowledgements.find((entry) => String(entry.hospital) === String(hospital));
    if (existing) return res.json({ recall, acknowledgement: existing, idempotent: true });
    const acknowledgement = { hospital, acknowledgedBy: req.user?._id, acknowledgedAt: new Date(), note: String(req.body?.note || "") };
    recall.hospitalAcknowledgements = [...acknowledgements, acknowledgement];
    await recall.save();
    await appendComplianceLedger({ actorId: req.user?._id, actorRole: normalizeRole(req.user?.role), action: "PHARMACY_RECALL_ACKNOWLEDGED", resource: "pharmacy_recall", resourceId: recall._id, hospital, metadata: { acknowledgement } });
    res.status(201).json({ recall, acknowledgement });
  } catch (err) {
    console.error("Recall acknowledgement error:", err);
    res.status(500).json({ msg: "Failed to acknowledge recall" });
  }
}

export async function submitRecallReconciliation(req, res) {
  try {
    const hospital = requireHospital(req, res);
    if (!hospital) return;
    const recall = await PharmacyRecall.findById(req.params.id).lean();
    if (!recall) return res.status(404).json({ msg: "Recall not found" });
    const report = await upsertDerivedDiscrepancies(recall);
    const rows = report.rows.filter((row) => String(row.hospital) === String(hospital));
    if (!rows.length) return res.status(404).json({ msg: "Recall batch is not assigned to this hospital" });
    const confirmedQuantity = req.body?.confirmedQuantity;
    if (confirmedQuantity !== undefined && (!Number.isFinite(Number(confirmedQuantity)) || Number(confirmedQuantity) < 0)) return res.status(400).json({ msg: "Physical quantity is invalid" });
    const discrepancies = await PharmacyRecallDiscrepancy.find({ recallId: recall._id, hospital }).lean();
    await PharmacyRecall.updateOne({ _id: recall._id }, { $pull: { hospitalReconciliations: { hospital } } });
    await PharmacyRecall.updateOne({ _id: recall._id }, { $push: { hospitalReconciliations: { hospital, submittedBy: req.user?._id, submittedAt: new Date(), reportedConfirmedQuantity: confirmedQuantity === undefined ? null : Number(confirmedQuantity), evidence: req.body?.evidence || {}, escalated: Boolean(req.body?.escalated) } } });
    res.status(200).json({ recallId: recall._id, hospital, authoritative: rows, discrepancies, clientQuantityAcceptedAsEvidenceOnly: confirmedQuantity === undefined ? false : true, submittedConfirmedQuantity: confirmedQuantity === undefined ? null : Number(confirmedQuantity) });
  } catch (err) {
    console.error("Recall submission error:", err);
    res.status(500).json({ msg: "Failed to submit recall reconciliation" });
  }
}

export async function resolveRecallDiscrepancy(req, res) {
  try {
    if (!isRegulator(req)) return res.status(403).json({ msg: "Regulator access required" });
    const discrepancy = await PharmacyRecallDiscrepancy.findOneAndUpdate({ _id: req.params.id, status: { $ne: "RESOLVED" } }, { $set: { status: "RESOLVED", evidence: req.body?.evidence || {}, reason: String(req.body?.reason || "Regulator disposition recorded"), resolvedBy: req.user?._id, resolvedAt: new Date() } }, { new: true });
    if (!discrepancy) return res.status(404).json({ msg: "Open discrepancy not found" });
    await appendComplianceLedger({ actorId: req.user?._id, actorRole: normalizeRole(req.user?.role), action: "PHARMACY_RECALL_DISCREPANCY_RESOLVED", resource: "pharmacy_recall_discrepancy", resourceId: discrepancy._id, hospital: discrepancy.hospital, metadata: { recallId: discrepancy.recallId, evidence: discrepancy.evidence } });
    res.json(discrepancy);
  } catch (err) {
    console.error("Recall discrepancy resolution error:", err);
    res.status(500).json({ msg: "Failed to resolve recall discrepancy" });
  }
}

export async function destroyBatch(req, res) {
  try {
    const hospital = requireHospital(req, res);
    if (!hospital) return;
    const { itemId, batchNumber, quantity, reason, evidence = {} } = req.body || {};
    const control = await PharmacyBatchControl.findOne({ hospital, itemId, batchNumber, status: { $in: ["QUARANTINED", "RECALLED"] } }).lean();
    if (!control) return res.status(409).json({ msg: "Only quarantined or recalled batches may be destroyed" });
    const item = await PharmacyItem.findOne({ _id: itemId, hospital });
    const batch = item?.batches.find((entry) => entry.batchNumber === String(batchNumber));
    const destroyQuantity = Number(quantity) || 0;
    if (!batch || destroyQuantity <= 0 || batch.quantity < destroyQuantity) return res.status(400).json({ msg: "Destruction quantity is invalid" });
    const eventCorrelationId = correlationId(req);
    const disposition = await PharmacyBatchDisposition.create({ hospital, itemId, batchNumber, supplier: control.supplier, disposition: "DESTROYED", quantity: destroyQuantity, reason: reason || "Regulatory destruction", evidence, createdBy: req.user?._id, correlationId: eventCorrelationId });
    const previousQuantity = item.totalQuantity;
    batch.quantity -= destroyQuantity;
    item.totalQuantity -= destroyQuantity;
    item.updatedBy = req.user?._id;
    await item.save();
    await PharmacyInventoryMovement.create({ itemId, hospital, movementType: "ADJUSTMENT", batchNumber, quantity: destroyQuantity, previousQuantity, newQuantity: item.totalQuantity, referenceType: "BATCH_DESTRUCTION", note: `Destroyed under disposition ${disposition._id}`, performedBy: req.user?._id });
    await appendComplianceLedger({ actorId: req.user?._id, actorRole: normalizeRole(req.user?.role), action: "BATCH_DESTROYED", resource: "pharmacy_batch", resourceId: control._id, hospital, metadata: { dispositionId: disposition._id, quantity: destroyQuantity, evidence, correlationId: eventCorrelationId } });
    res.status(201).json({ disposition, item });
  } catch (err) {
    console.error("Batch destruction error:", err);
    res.status(500).json({ msg: "Failed to destroy batch" });
  }
}

export async function updateRecall(req, res) {
  try {
    if (!isRegulator(req)) return res.status(403).json({ msg: "Regulator access required" });
    const requestedStatus = String(req.body?.status || "").toUpperCase();
    if (!["DRAFT", "ACTIVE", "CONTAINMENT", "RECONCILIATION", "CLOSED", "OPEN", "UNDER_INVESTIGATION"].includes(requestedStatus)) return res.status(400).json({ msg: "Invalid recall status" });
    const status = requestedStatus;
    const existing = await PharmacyRecall.findById(req.params.id);
    if (!existing) return res.status(404).json({ msg: "Recall not found" });
    const allowed = RECALL_LIFECYCLE[existing.status] || RECALL_LIFECYCLE[status] || [];
    if (status && !allowed.includes(status) && existing.status !== status) {
      return res.status(409).json({ msg: `Cannot move recall from ${existing.status} to ${status}` });
    }
    const reconciliation = await upsertDerivedDiscrepancies(existing);
    if (status === "CLOSED") {
      const decision = closureDecision(reconciliation);
      if (!decision.allowed) return res.status(409).json({ code: decision.code, reasons: decision.reasons, reconciliation: decision.report });
    }
    const recall = await PharmacyRecall.findByIdAndUpdate(req.params.id, { $set: { status, closedAt: status === "CLOSED" ? new Date() : null, closedBy: status === "CLOSED" ? req.user?._id : null, traceCompleteness: reconciliation.completeness === "TRACE_COMPLETE" ? 100 : existing.traceCompleteness, reconciliationSummary: reconciliation.totals } }, { new: true });
    if (!recall) return res.status(404).json({ msg: "Recall not found" });
    await appendComplianceLedger({ actorId: req.user?._id, actorRole: normalizeRole(req.user?.role), action: `PHARMACY_RECALL_${status}`, resource: "pharmacy_recall", resourceId: recall._id, metadata: { authorityReference: recall.authorityReference } });
    res.json(recall);
  } catch (err) {
    console.error("Recall update error:", err);
    res.status(500).json({ msg: "Failed to update recall" });
  }
}

export async function listGovernmentSuppliers(req, res) {
  if (!isRegulator(req)) return res.status(403).json({ msg: "Regulator access required" });
  const suppliers = await PharmacySupplier.find({}).sort({ regulatoryStatus: 1, name: 1 }).lean();
  const licenses = await SupplierLicense.find({ supplier: { $in: suppliers.map((supplier) => supplier._id) } }).lean();
  const licensesBySupplier = new Map(licenses.map((license) => [String(license.supplier), license]));
  res.json({ suppliers: suppliers.map((supplier) => ({ ...supplier, license: licensesBySupplier.get(String(supplier._id)) || null })) });
}

export async function updateGovernmentSupplier(req, res) {
  try {
    if (!isRegulator(req)) return res.status(403).json({ msg: "Regulator access required" });
    const status = String(req.body?.status || "").toUpperCase();
    if (!["PENDING", "ACTIVE", "SUSPENDED", "REVOKED"].includes(status)) return res.status(400).json({ msg: "Invalid supplier regulatory status" });
    const supplier = await PharmacySupplier.findByIdAndUpdate(req.params.id, { $set: { regulatoryStatus: status, regulatoryReference: req.body?.reference || "", regulatoryAuthority: req.body?.authority || "PPB", active: !["SUSPENDED", "REVOKED"].includes(status) } }, { new: true });
    if (!supplier) return res.status(404).json({ msg: "Supplier not found" });
    await appendComplianceLedger({ actorId: req.user?._id, actorRole: normalizeRole(req.user?.role), action: `SUPPLIER_${status}`, resource: "pharmacy_supplier", resourceId: supplier._id, metadata: { authority: supplier.regulatoryAuthority, reference: supplier.regulatoryReference } });
    res.json(supplier);
  } catch (err) {
    console.error("Government supplier status error:", err);
    res.status(500).json({ msg: "Failed to update supplier status" });
  }
}

export async function listNationalQuarantine(req, res) {
  if (!isRegulator(req)) return res.status(403).json({ msg: "Regulator access required" });
  const controls = await PharmacyBatchControl.find({ status: { $in: ["QUARANTINED", "RECALLED"] } }).populate("hospital", "name code").populate("supplier", "name regulatoryStatus").populate("regulatoryProduct", "registrationNumber tradeName manufacturer").sort({ updatedAt: -1 }).limit(1000).lean();
  res.json({ controls });
}

export async function traceBatch(req, res) {
  if (!isRegulator(req)) return res.status(403).json({ msg: "Regulator access required" });
  const filter = { $or: [{ batchNumber: req.params.batchId }] };
  if (req.params.batchId.match(/^[0-9a-fA-F]{24}$/)) filter.$or.push({ _id: req.params.batchId });
  const controls = await PharmacyBatchControl.find(filter).populate("hospital", "name code").populate("supplier", "name").populate("regulatoryProduct", "registrationNumber tradeName manufacturer").lean();
  const purchaseOrderIds = controls.map((control) => control.purchaseOrder).filter(Boolean);
  const batchNumbers = [...new Set(controls.map((control) => control.batchNumber))];
  const [orders, receipts, movements, dispositions] = await Promise.all([
    PharmacyPurchaseOrder.find({ _id: { $in: purchaseOrderIds } }).lean(),
    PharmacyGoodsReceipt.find({ purchaseOrder: { $in: purchaseOrderIds } }).lean(),
    PharmacyInventoryMovement.find({ itemId: { $in: controls.map((control) => control.itemId) }, batchNumber: { $in: batchNumbers } }).sort({ createdAt: 1 }).lean(),
    PharmacyBatchDisposition.find({ itemId: { $in: controls.map((control) => control.itemId) }, batchNumber: { $in: batchNumbers } }).sort({ createdAt: 1 }).lean(),
  ]);
  const events = await PharmacyVerificationEvent.find({ batchNumber: { $in: batchNumbers } }).sort({ createdAt: 1 }).lean();
  res.json({ batch: req.params.batchId, controls, purchaseOrders: orders, receipts, movements, dispositions, verificationEvents: events });
}

export async function listSupplierCompliance(req, res) {
  try {
    const role = normalizeRole(req.user?.role);
    const supplierFilter = role === "SUPPLIER" ? { _id: req.user?.supplier } : {};
    const suppliers = await PharmacySupplier.find(supplierFilter).lean();
    const licenses = await SupplierLicense.find({ supplier: { $in: suppliers.map((supplier) => supplier._id) } }).lean();
    const events = await PharmacyVerificationEvent.find({ supplier: { $in: suppliers.map((supplier) => supplier._id) } }).select("supplier result riskSignals").lean();
    const controls = await PharmacyBatchControl.find({ supplier: { $in: suppliers.map((supplier) => supplier._id) }, status: { $in: ["QUARANTINED", "RECALLED"] } }).select("supplier status").lean();
    const licenseBySupplier = new Map(licenses.map((license) => [String(license.supplier), license]));
    const compliance = suppliers.map((supplier) => {
      const license = licenseBySupplier.get(String(supplier._id));
      const supplierEvents = events.filter((event) => String(event.supplier) === String(supplier._id));
      const failures = supplierEvents.filter((event) => event.result !== "VERIFIED").length;
      const holds = controls.filter((control) => String(control.supplier) === String(supplier._id)).length;
      const licenseValid = license?.status === "ACTIVE" && (!license.expiresAt || new Date(license.expiresAt) >= new Date());
      const score = Math.max(0, Math.min(100, 100 - (licenseValid ? 0 : 40) - failures * 10 - holds * 15));
      const signals = [];
      if (!licenseValid) signals.push("LICENSE_INVALID_OR_MISSING");
      if (failures) signals.push(`${failures}_VERIFICATION_FAILURES`);
      if (holds) signals.push(`${holds}_ACTIVE_BATCH_HOLDS`);
      PharmacySupplier.updateOne({ _id: supplier._id }, { $set: { trustScore: score } }).catch(() => {});
      return { supplier, license: license || null, score, status: supplier.regulatoryStatus, verificationFailures: failures, activeBatchHolds: holds, signals };
    });
    res.json({ compliance });
  } catch (err) {
    console.error("Supplier compliance error:", err);
    res.status(500).json({ msg: "Failed to calculate supplier compliance" });
  }
}

export async function listSafetySignals(req, res) {
  const role = normalizeRole(req.user?.role);
  const government = ["GOVERNMENT_REGULATOR", "GOVERNMENT_ADMIN", "GOVERNMENT_AUDITOR", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"].includes(role);
  const filter = government ? {} : normalizeRole(req.user?.role) === "SUPPLIER" ? { supplier: req.user?.supplier } : { hospital: requireHospital(req, res) };
  if (!filter.hospital && !filter.supplier && !government) return;
  const signals = await MedicineSafetySignal.find(filter).sort({ severity: -1, createdAt: -1 }).limit(500).lean();
  res.json({ signals });
}

export async function transitionSafetySignal(req, res) {
  const role = normalizeRole(req.user?.role);
  const regulator = ["GOVERNMENT_REGULATOR", "GOVERNMENT_ADMIN", "GOVERNMENT_AUDITOR", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"].includes(role);
  const nextStatus = String(req.body?.status || "").toUpperCase();
  if (!regulator || !["ACKNOWLEDGED", "INVESTIGATING", "ACTION_REQUIRED", "RESOLVED"].includes(nextStatus)) return res.status(403).json({ msg: "Authorized regulator action required" });
  const signal = await MedicineSafetySignal.findById(req.params.id);
  if (!signal) return res.status(404).json({ msg: "Safety signal not found" });
  const allowed = { OPEN: ["ACKNOWLEDGED"], ACKNOWLEDGED: ["INVESTIGATING"], INVESTIGATING: ["ACTION_REQUIRED", "RESOLVED"], ACTION_REQUIRED: ["RESOLVED"], RESOLVED: [] };
  if (!allowed[signal.status]?.includes(nextStatus)) return res.status(409).json({ msg: `Cannot move safety signal from ${signal.status} to ${nextStatus}` });
  assertAiCannotDecide(req.body?.action, signal.origin);
  signal.status = nextStatus;
  signal.notes = String(req.body?.notes || signal.notes || "");
  if (nextStatus === "RESOLVED") { signal.resolvedBy = req.user?._id; signal.resolvedAt = new Date(); signal.resolution = { decision: req.body?.action || "RESOLVED", reason: req.body?.reason || "", evidence: req.body?.evidence || [] }; }
  await signal.save();
  await appendComplianceLedger({ actorId: req.user?._id, actorRole: role, action: `SAFETY_SIGNAL_${nextStatus}`, resource: "medicine_safety_signal", resourceId: signal._id, hospital: signal.hospital, metadata: { reason: req.body?.reason || "", evidence: req.body?.evidence || [], correlationId: signal.correlationId } });
  res.json(signal);
}

export async function applyRegulatoryAction(req, res) {
  try {
    const actorRole = normalizeRole(req.user?.role);
    if (!REGULATOR_ROLES.includes(actorRole)) {
      return res.status(403).json({ msg: "Regulator access required" });
    }

    const rawAction = String(req.body?.action || req.body?.type || "").toUpperCase();
    const allowedActions = new Set([
      "SUSPEND_SUPPLIER",
      "REINSTATE_SUPPLIER",
      "SUSPEND_PRODUCT_REGISTRATION",
      "REINSTATE_PRODUCT",
      "QUARANTINE_BATCH",
      "RELEASE_BATCH",
      "ISSUE_RECALL",
      "CLOSE_RECALL",
      "ESCALATE_SAFETY_ALERT",
    ]);

    if (!allowedActions.has(rawAction)) {
      return res.status(400).json({ msg: `Unsupported regulatory action: ${rawAction || "UNKNOWN"}` });
    }

    const forbiddenDirect = ["APPROVED", "RELEASED", "SAFE_FOR_CONSUMPTION", "SUPPLIER_SUSPENDED"];
    if (forbiddenDirect.includes(rawAction)) {
      return res.status(403).json({ msg: "AI cannot directly issue this decision" });
    }

    const reason = String(req.body?.reason || "");
    const evidence = Array.isArray(req.body?.evidence) ? req.body.evidence : [];
    const correlationId = String(req.body?.correlationId || crypto.randomUUID());

    let target = null;
    let resource = null;

    if (rawAction === "SUSPEND_SUPPLIER" || rawAction === "REINSTATE_SUPPLIER") {
      const supplierId = req.body?.supplierId || req.body?.id;
      if (!supplierId) return res.status(400).json({ msg: "Supplier target required" });
      target = await PharmacySupplier.findByIdAndUpdate(
        supplierId,
        { $set: { regulatoryStatus: rawAction === "SUSPEND_SUPPLIER" ? "SUSPENDED" : "ACTIVE", active: rawAction === "REINSTATE_SUPPLIER", regulatoryReference: String(req.body?.reference || ""), regulatoryAuthority: String(req.body?.authority || "PPB") } },
        { new: true }
      );
      resource = "pharmacy_supplier";
    }

    if (rawAction === "SUSPEND_PRODUCT_REGISTRATION" || rawAction === "REINSTATE_PRODUCT") {
      const productId = req.body?.productId || req.body?.id;
      if (!productId) return res.status(400).json({ msg: "Product target required" });
      target = await RegulatoryProduct.findByIdAndUpdate(
        productId,
        { $set: { status: rawAction === "SUSPEND_PRODUCT_REGISTRATION" ? "SUSPENDED" : "ACTIVE", updatedBy: req.user?._id } },
        { new: true }
      );
      resource = "regulatory_product";
    }

    if (rawAction === "QUARANTINE_BATCH" || rawAction === "RELEASE_BATCH") {
      const batchId = req.body?.batchId || req.body?.controlId || req.body?.id;
      if (!batchId) return res.status(400).json({ msg: "Batch control target required" });
      target = await PharmacyBatchControl.findByIdAndUpdate(
        batchId,
        { $set: { status: rawAction === "QUARANTINE_BATCH" ? "QUARANTINED" : "RELEASED", verificationStatus: rawAction === "QUARANTINE_BATCH" ? "QUARANTINED" : "VERIFIED", reason: reason || "Regulatory control action", updatedBy: req.user?._id, quarantinedAt: rawAction === "QUARANTINE_BATCH" ? new Date() : null } },
        { new: true }
      );
      resource = "pharmacy_batch";
    }

    if (rawAction === "ISSUE_RECALL" || rawAction === "CLOSE_RECALL") {
      const recallId = req.body?.recallId || req.body?.id;
      if (rawAction === "ISSUE_RECALL" && !req.body?.batchNumber && !req.body?.registrationNumber) {
        return res.status(400).json({ msg: "Recall target required" });
      }
      if (rawAction === "ISSUE_RECALL") {
        const recallData = {
          registrationNumber: req.body?.registrationNumber || "",
          batchNumber: req.body?.batchNumber || "",
          reason: reason || "Regulatory recall",
          authority: String(req.body?.authority || "PPB"),
          authorityReference: String(req.body?.reference || req.body?.authorityReference || ""),
          createdBy: req.user?._id,
          status: "ACTIVE",
        };
        const existingRecall = await PharmacyRecall.findOne({ registrationNumber: recallData.registrationNumber || "", batchNumber: recallData.batchNumber || "", status: { $in: ["OPEN", "UNDER_INVESTIGATION"] } }).lean();
        if (existingRecall) {
          target = existingRecall;
        } else {
          target = await PharmacyRecall.create(recallData);
          const filter = recallFilter(target);
          const controls = await PharmacyBatchControl.find(filter).select("_id hospital itemId batchNumber").lean();
          await PharmacyBatchControl.updateMany(filter, { $set: { status: "RECALLED", verificationStatus: "QUARANTINED", reason: target.reason, authorityReference: target.authorityReference, updatedBy: req.user?._id } });
          await Promise.all(controls.map((control) => PharmacyItem.updateOne({ _id: control.itemId, hospital: control.hospital, "batches.batchNumber": target.batchNumber }, { $set: { "batches.$.verificationStatus": "RECALLED" } })));
        }
      } else {
        const recallTarget = await PharmacyRecall.findById(recallId).lean();
        if (!recallTarget) return res.status(404).json({ msg: "Recall not found" });
        const report = await upsertDerivedDiscrepancies(recallTarget);
        const decision = closureDecision(report);
        if (!decision.allowed) return res.status(409).json({ code: decision.code, reasons: decision.reasons, reconciliation: report });
        target = await PharmacyRecall.findByIdAndUpdate(recallId, { $set: { status: "CLOSED", closedAt: new Date(), closedBy: req.user?._id, closureEvidence: { evidenceHash: (await buildRecallEvidencePackage(recallTarget)).evidenceHash, report } } }, { new: true });
      }
      resource = "pharmacy_recall";
    }

    if (rawAction === "ESCALATE_SAFETY_ALERT") {
      const alertId = req.body?.alertId || req.body?.id || req.body?.signalId;
      if (!alertId) return res.status(400).json({ msg: "Alert target required" });
      target = await MedicineSafetySignal.findByIdAndUpdate(alertId, { $set: { status: "ACTION_REQUIRED", notes: reason || "Escalated for regulator response" } }, { new: true });
      resource = "medicine_safety_signal";
    }

    if (!target) return res.status(400).json({ msg: "Regulatory action target could not be resolved" });

    await appendComplianceLedger({
      actorId: req.user?._id,
      actorRole: actorRole,
      action: rawAction,
      resource,
      resourceId: target?._id || target?.id,
      hospital: req.body?.hospitalId || req.user?.hospital || null,
      metadata: {
        actor: actorRole,
        role: actorRole,
        reason,
        evidence,
        timestamp: new Date().toISOString(),
        correlationId,
      },
    });

    res.status(200).json({ action: rawAction, result: target, correlationId, auditRecorded: true });
  } catch (err) {
    console.error("Regulatory action error:", err);
    res.status(500).json({ msg: "Failed to apply regulatory action" });
  }
}

const sanitizeInvestigationPayload = (payload) => {
  const clone = JSON.parse(JSON.stringify(payload || {}));
  const scrub = (value) => {
    if (Array.isArray(value)) return value.map((item) => scrub(item));
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value)
          .filter(([key]) => {
            const normalized = String(key).toLowerCase();
            return normalized === "privacy" || normalized === "patientidentifiersexcluded" || !normalized.includes("patient");
          })
          .map(([key, child]) => [key, scrub(child)])
      );
    }
    return value;
  };
  return scrub(clone);
};

export async function getInvestigationReport(req, res) {
  try {
    if (!isRegulator(req)) return res.status(403).json({ msg: "Regulator access required" });
    const type = String(req.params?.type || req.query?.type || "alert").toLowerCase();
    const targetId = req.params?.id;
    let payload = { privacy: { identifiersExcluded: true }, generatedAt: new Date().toISOString() };

    if (type === "batch") {
      const evidence = await buildEvidencePackage({ batchNumber: targetId });
      const recall = evidence.recalls?.[0];
      payload = { ...payload, ...evidence, ...(recall ? { reconciliation: await deriveRecallReconciliation(recall) } : {}) };
    } else if (type === "supplier") {
      const supplier = await PharmacySupplier.findById(targetId).lean();
      const licenses = await SupplierLicense.find({ supplier: targetId }).lean();
      const controls = await PharmacyBatchControl.find({ supplier: targetId }).lean();
      const verificationEvents = await PharmacyVerificationEvent.find({ supplier: targetId }).sort({ createdAt: 1 }).lean();
      payload = { ...payload, supplier, licenses, controls, verificationEvents };
    } else if (type === "product") {
      const product = await RegulatoryProduct.findById(targetId).lean();
      const controls = await PharmacyBatchControl.find({ regulatoryProduct: targetId }).lean();
      const recallHistory = await PharmacyRecall.find({ regulatoryProduct: targetId }).lean();
      payload = { ...payload, product, controls, recallHistory };
    } else {
      const alert = await MedicineSafetySignal.findById(targetId).lean();
      payload = { ...payload, alert };
    }

    payload = sanitizeInvestigationPayload(payload);
    res.json(payload);
  } catch (err) {
    console.error("Investigation report error:", err);
    res.status(500).json({ msg: "Failed to load investigation report" });
  }
}

export async function getBatchInvestigation(req, res) {
  if (!isRegulator(req)) return res.status(403).json({ msg: "Regulator access required" });
  const evidence = await buildEvidencePackage({ batchNumber: req.params.id });
  res.json({ ...evidence, privacy: { identifiersExcluded: true } });
}

export async function getNationalRiskAggregation(req, res) {
  if (!isRegulator(req)) return res.status(403).json({ msg: "Regulator access required" });
  const [signals, suppliers, controls, recalls] = await Promise.all([
    MedicineSafetySignal.find({ status: { $ne: "RESOLVED" } }).sort({ score: -1, createdAt: -1 }).limit(1000).lean(),
    PharmacySupplier.find({}).select("name regulatoryStatus trustScore").sort({ trustScore: 1 }).limit(500).lean(),
    PharmacyBatchControl.find({ status: { $in: ["QUARANTINED", "RECALLED"] } }).select("hospital supplier regulatoryProduct batchNumber status").lean(),
    PharmacyRecall.find({ status: { $ne: "CLOSED" } }).select("_id batchNumber registrationNumber status traceCompleteness unresolvedDiscrepancies").lean(),
  ]);
  res.json({ highestRiskSuppliers: suppliers, suspiciousBatches: controls, activeRegulatoryConcerns: signals.filter((signal) => ["HIGH", "CRITICAL"].includes(signal.severity)), unresolvedInvestigations: signals.filter((signal) => ["INVESTIGATING", "ACTION_REQUIRED"].includes(signal.status)), recallExposure: recalls, verificationFailureRate: signals.length ? Math.round((signals.filter((signal) => signal.signalType === "VERIFICATION_FAILURE").length / signals.length) * 100) : 0, affectedHospitals: [...new Set(controls.map((control) => String(control.hospital)))], generatedAt: new Date().toISOString() });
}

export async function getNationalSafetyMetrics(req, res) {
  if (!isRegulator(req)) return res.status(403).json({ msg: "Regulator access required" });
  const [activeRecalls, quarantinedControls, criticalAlerts, paymentHolds, failedVerifications, stockRiskProducts] = await Promise.all([
    PharmacyRecall.countDocuments({ status: { $in: ["DRAFT", "ACTIVE", "CONTAINMENT", "RECONCILIATION", "OPEN", "UNDER_INVESTIGATION"] } }),
    PharmacyBatchControl.find({ status: { $in: ["QUARANTINED", "RECALLED"] } }).select("hospital").lean(),
    MedicineSafetySignal.countDocuments({ severity: "CRITICAL", status: { $ne: "RESOLVED" } }),
    (await import("../models/PharmacySupplierInvoice.js")).default.countDocuments({ status: { $in: ["ISSUED", "PARTIALLY_PAID"] } }),
    PharmacyVerificationEvent.countDocuments({ result: { $in: ["FAILED", "QUARANTINED"] } }),
    (await import("../models/PharmacyItem.js")).default.countDocuments({ active: { $ne: false }, $expr: { $lte: ["$totalQuantity", "$minStock"] } }),
  ]);
  res.json({ metrics: { activeRecalls, affectedHospitals: new Set(quarantinedControls.map((control) => String(control.hospital))).size, quarantinedBatches: quarantinedControls.length, unresolvedCriticalAlerts: criticalAlerts, supplierPaymentHolds: paymentHolds, verificationFailures: failedVerifications, stockoutRiskProducts } });
}

export async function returnBatchToSupplier(req, res) {
  try {
    const hospital = requireHospital(req, res);
    if (!hospital) return;
    const { itemId, batchNumber, quantity, reason, evidence = {} } = req.body || {};
    const control = await PharmacyBatchControl.findOne({ hospital, itemId, batchNumber, status: { $in: ["QUARANTINED", "RECALLED"] } }).lean();
    if (!control) return res.status(409).json({ msg: "Only quarantined or recalled batches may be returned" });
    const item = await PharmacyItem.findOne({ _id: itemId, hospital });
    const batch = item?.batches.find((entry) => entry.batchNumber === String(batchNumber));
    const returnQuantity = Number(quantity) || 0;
    if (!batch || returnQuantity <= 0 || batch.quantity < returnQuantity) return res.status(400).json({ msg: "Return quantity is invalid" });
    const eventCorrelationId = correlationId(req);
    const disposition = await PharmacyBatchDisposition.create({ hospital, itemId, batchNumber, supplier: control.supplier, disposition: "RETURNED", quantity: returnQuantity, reason: reason || "Regulatory hold return", evidence, createdBy: req.user?._id, correlationId: eventCorrelationId });
    const previousQuantity = item.totalQuantity;
    batch.quantity -= returnQuantity;
    item.totalQuantity -= returnQuantity;
    item.updatedBy = req.user?._id;
    await item.save();
    await PharmacyInventoryMovement.create({ itemId, hospital, movementType: "RETURN", batchNumber, quantity: returnQuantity, previousQuantity, newQuantity: item.totalQuantity, referenceType: "BATCH_RETURN", note: `Returned under disposition ${disposition._id}`, performedBy: req.user?._id });
    await appendComplianceLedger({ actorId: req.user?._id, actorRole: normalizeRole(req.user?.role), action: "BATCH_RETURNED", resource: "pharmacy_batch", resourceId: control._id, hospital, metadata: { dispositionId: disposition._id, quantity: returnQuantity, reason, correlationId: eventCorrelationId } });
    const recallId = await resolveActiveRecallId({ hospital, itemId, batchNumber });
    if (recallId) {
      await PharmacyRecallDiscrepancy.create({ recallId, hospital, itemId, batchNumber, returned: returnQuantity, reason: reason || "Returned to supplier", severity: "MEDIUM", status: "OPEN", correlationId: eventCorrelationId, createdBy: req.user?._id });
    }
    res.status(201).json({ disposition, item });
  } catch (err) {
    console.error("Batch return error:", err);
    res.status(500).json({ msg: "Failed to return batch" });
  }
}

export async function transferBatch(req, res) {
  try {
    const hospital = requireHospital(req, res);
    if (!hospital) return;
    const { itemId, batchNumber, quantity, destinationHospital, reason } = req.body || {};
    if (!destinationHospital || String(destinationHospital) === String(hospital)) return res.status(400).json({ msg: "A different destination hospital is required" });
    const control = await PharmacyBatchControl.findOne({ hospital, itemId, batchNumber }).lean();
    if (!control || !["ACTIVE", "RELEASED"].includes(control.status)) return res.status(409).json({ msg: "Quarantined or recalled batches cannot be transferred" });
    const item = await PharmacyItem.findOne({ _id: itemId, hospital });
    const batch = item?.batches.find((entry) => entry.batchNumber === String(batchNumber));
    const transferQuantity = Number(quantity) || 0;
    if (!batch || transferQuantity <= 0 || batch.quantity < transferQuantity) return res.status(400).json({ msg: "Transfer quantity is invalid" });
    const eventCorrelationId = correlationId(req);
    const disposition = await PharmacyBatchDisposition.create({ hospital, itemId, batchNumber, supplier: control.supplier, destinationHospital, disposition: "TRANSFERRED", quantity: transferQuantity, reason: reason || "Inter-hospital transfer", createdBy: req.user?._id, correlationId: eventCorrelationId });
    const previousQuantity = item.totalQuantity;
    batch.quantity -= transferQuantity;
    item.totalQuantity -= transferQuantity;
    item.updatedBy = req.user?._id;
    await item.save();
    await PharmacyInventoryMovement.create({ itemId, hospital, movementType: "TRANSFER", batchNumber, quantity: transferQuantity, previousQuantity, newQuantity: item.totalQuantity, referenceType: "INTER_HOSPITAL_TRANSFER", note: `Transfer ${disposition._id} pending destination receipt`, performedBy: req.user?._id });
    await appendComplianceLedger({ actorId: req.user?._id, actorRole: normalizeRole(req.user?.role), action: "BATCH_TRANSFERRED", resource: "pharmacy_batch", resourceId: control._id, hospital, metadata: { dispositionId: disposition._id, destinationHospital, quantity: transferQuantity, correlationId: eventCorrelationId } });
    const recallId = await resolveActiveRecallId({ hospital, itemId, batchNumber });
    if (recallId) {
      await PharmacyRecallDiscrepancy.create({ recallId, hospital, itemId, batchNumber, transferred: transferQuantity, reason: reason || "Inter-hospital transfer", severity: "MEDIUM", status: "OPEN", correlationId: eventCorrelationId, createdBy: req.user?._id });
    }
    res.status(201).json({ disposition, item });
  } catch (err) {
    console.error("Batch transfer error:", err);
    res.status(500).json({ msg: "Failed to transfer batch" });
  }
}

async function resolveActiveRecallId({ hospital, itemId, batchNumber }) {
  const recall = await PharmacyRecall.findOne({
    $or: [
      { batchNumber },
      { hospital },
    ],
    status: { $in: ["ACTIVE", "CONTAINMENT", "RECONCILIATION", "OPEN", "UNDER_INVESTIGATION"] },
  }).sort({ createdAt: -1 }).lean();

  return recall?._id || null;
}
