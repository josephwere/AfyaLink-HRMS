import crypto from "node:crypto";
import MedicineSafetySignal from "../models/MedicineSafetySignal.js";
import PharmacyVerificationEvent from "../models/PharmacyVerificationEvent.js";
import PharmacyRecall from "../models/PharmacyRecall.js";
import PharmacyBatchDisposition from "../models/PharmacyBatchDisposition.js";
import PharmacySupplier from "../models/PharmacySupplier.js";
import PharmacyPurchaseOrder from "../models/PharmacyPurchaseOrder.js";
import PharmacyGoodsReceipt from "../models/PharmacyGoodsReceipt.js";
import PharmacyInventoryMovement from "../models/PharmacyInventoryMovement.js";
import SupplierLicense from "../models/SupplierLicense.js";
import RegulatoryProduct from "../models/RegulatoryProduct.js";
import ComplianceLedger from "../models/ComplianceLedger.js";
import { appendComplianceLedger } from "../utils/complianceLedger.js";
import { notifyRolesInHospital } from "./notificationService.js";

const hash = (value) => crypto.createHash("sha256").update(JSON.stringify(value || {})).digest("hex");

const severityFor = (score) => score >= 85 ? "CRITICAL" : score >= 65 ? "HIGH" : score >= 35 ? "MEDIUM" : "LOW";

export async function createRiskSignal({ signalType, origin = "AI", score = 0, confidence = score, explanation, signals = [], hospital = null, itemId = null, batchNumber = "", supplier = null, regulatoryProduct = null, sourceRefs = [], evidenceIds = [], correlationId = crypto.randomUUID(), input = {}, ruleVersion = "medicine-safety-v1" }) {
  if (!["AI", "RULE", "REGULATORY"].includes(origin)) throw new Error("Invalid signal origin");
  const inputHash = hash({ signalType, hospital, itemId, batchNumber, supplier, input });
  const existing = await MedicineSafetySignal.findOne({ "detection.inputHash": inputHash, status: { $ne: "RESOLVED" } }).lean();
  if (existing) return { signal: existing, idempotent: true };
  const signal = await MedicineSafetySignal.create({ alertId: null, signalType, origin, score, confidence, severity: severityFor(score), explanation, signals, hospital, itemId, batchNumber, supplier, regulatoryProduct, sourceRefs, evidenceIds, correlationId, detection: { inputHash, ruleVersion, detectedAt: new Date() } });
  signal.alertId = signal._id;
  await signal.save();
  await appendComplianceLedger({ actorRole: origin === "AI" ? "AI" : "SYSTEM", action: "MEDICINE_RISK_SIGNAL_CREATED", resource: "medicine_safety_signal", resourceId: signal._id, hospital, metadata: { signalType, severity: signal.severity, origin, correlationId, evidenceIds } });
  if (hospital && ["HIGH", "CRITICAL"].includes(signal.severity)) {
    await notifyRolesInHospital({ hospital, roles: ["PHARMACIST", "HOSPITAL_ADMIN"], title: `Medicine safety signal: ${signal.severity}`, body: explanation, category: "PHARMACY_SAFETY", meta: { type: "MEDICINE_SAFETY_SIGNAL", signalId: signal._id, correlationId, idempotencyKey: `safety-signal:${signal._id}` } });
  }
  return { signal, idempotent: false };
}

export async function evaluateVerificationEvent(event) {
  if (!event || event.result === "VERIFIED") return null;
  const score = Math.min(100, 55 + (event.riskSignals?.length || 1) * 12);
  return createRiskSignal({ signalType: "VERIFICATION_FAILURE", origin: "RULE", score, explanation: `Batch verification failed: ${(event.riskSignals || []).join(", ") || "unspecified verification failure"}.`, signals: event.riskSignals || [], hospital: event.hospital, itemId: event.itemId, batchNumber: event.batchNumber, supplier: event.supplier, sourceRefs: [{ resource: "pharmacy_verification_event", resourceId: event._id, correlationId: event.correlationId }], evidenceIds: [String(event._id)], correlationId: event.correlationId, input: { evidenceHash: event.evidenceHash } });
}

export async function evaluateRecall(recall, controls = []) {
  return createRiskSignal({ signalType: "POTENTIAL_RECALL_IMPACT", origin: "REGULATORY", score: 100, explanation: `Regulatory recall ${recall.authorityReference || recall._id} affects ${controls.length} tracked batch controls.`, signals: ["ACTIVE_RECALL"], batchNumber: recall.batchNumber, regulatoryProduct: recall.regulatoryProduct, sourceRefs: controls.map((control) => ({ resource: "pharmacy_batch_control", resourceId: control._id })), correlationId: crypto.randomUUID(), input: { recallId: recall._id, controls: controls.map((control) => String(control._id)) } });
}

export async function evaluatePriceAnomaly({ supplier, itemId, unitPrice, baselinePrices = [], correlationId = crypto.randomUUID() }) {
  const prices = baselinePrices.map(Number).filter((price) => Number.isFinite(price) && price > 0);
  if (!prices.length || !Number.isFinite(Number(unitPrice))) return null;
  const baseline = prices.reduce((total, price) => total + price, 0) / prices.length;
  const deviation = Math.abs(Number(unitPrice) - baseline) / baseline;
  if (deviation < 0.3) return null;
  return createRiskSignal({ signalType: "PRICE_ANOMALY", origin: "RULE", score: Math.min(100, Math.round(55 + deviation * 100)), confidence: Math.min(100, Math.round(60 + prices.length * 5)), explanation: `Supplier price ${unitPrice} deviates ${Math.round(deviation * 100)}% from the evidence baseline ${baseline.toFixed(2)}.`, signals: [Number(unitPrice) < baseline ? "PRICE_BELOW_BASELINE" : "PRICE_ABOVE_BASELINE"], itemId, supplier, correlationId, input: { unitPrice, baseline, sampleSize: prices.length } });
}

export async function evaluateDuplicateBatch({ batchNumber, controls = [], correlationId = crypto.randomUUID() }) {
  const hospitals = new Set(controls.map((control) => String(control.hospital)));
  if (!batchNumber || hospitals.size < 2) return null;
  return createRiskSignal({ signalType: "DUPLICATE_BATCH_NUMBER", origin: "RULE", score: 80, confidence: 90, explanation: `Batch ${batchNumber} is active across ${hospitals.size} hospitals and requires trace review.`, signals: ["CROSS_HOSPITAL_BATCH_REUSE"], batchNumber, sourceRefs: controls.map((control) => ({ resource: "pharmacy_batch_control", resourceId: control._id, correlationId })), correlationId, input: { hospitals: [...hospitals] } });
}

export async function evaluateSupplierCompliance(supplierId) {
  const [supplier, events, dispositions] = await Promise.all([
    PharmacySupplier.findById(supplierId).lean(),
    PharmacyVerificationEvent.find({ supplier: supplierId }).select("result riskSignals").lean(),
    PharmacyBatchDisposition.find({ supplier: supplierId }).select("disposition quantity").lean(),
  ]);
  if (!supplier) return null;
  const failures = events.filter((event) => event.result !== "VERIFIED").length;
  const returns = dispositions.filter((item) => item.disposition === "RETURNED").length;
  const score = Math.max(0, Math.min(100, (supplier.regulatoryStatus === "ACTIVE" ? 100 : 55) - failures * 10 - returns * 5));
  return { supplierId, score, severity: severityFor(100 - score), evidence: { regulatoryStatus: supplier.regulatoryStatus, verificationFailures: failures, returnedBatches: returns } };
}

export async function buildEvidencePackage({ batchNumber, hospital = null }) {
  const eventFilter = { batchNumber };
  const controlFilter = { batchNumber };
  if (hospital) { eventFilter.hospital = hospital; controlFilter.hospital = hospital; }
  const [verificationEvents, controls, recalls, dispositions] = await Promise.all([
    PharmacyVerificationEvent.find(eventFilter).sort({ createdAt: 1 }).lean(),
    (await import("../models/PharmacyBatchControl.js")).default.find(controlFilter).sort({ createdAt: 1 }).lean(),
    PharmacyRecall.find({ batchNumber }).sort({ createdAt: 1 }).lean(),
    PharmacyBatchDisposition.find({ batchNumber }).sort({ createdAt: 1 }).lean(),
  ]);
  const purchaseOrderIds = controls.map((control) => control.purchaseOrder).filter(Boolean);
  const supplierIds = controls.map((control) => control.supplier).filter(Boolean);
  const productIds = controls.map((control) => control.regulatoryProduct).filter(Boolean);
  const itemIds = controls.map((control) => control.itemId).filter(Boolean);
  const [purchaseOrders, receipts, movements, suppliers, licenses, products, safetySignals, ledger] = await Promise.all([
    PharmacyPurchaseOrder.find({ _id: { $in: purchaseOrderIds } }).lean(),
    PharmacyGoodsReceipt.find({ purchaseOrder: { $in: purchaseOrderIds } }).lean(),
    PharmacyInventoryMovement.find({ itemId: { $in: itemIds }, batchNumber }).sort({ createdAt: 1 }).lean(),
    PharmacySupplier.find({ _id: { $in: supplierIds } }).select("name regulatoryStatus regulatoryAuthority regulatoryReference").lean(),
    SupplierLicense.find({ supplier: { $in: supplierIds } }).lean(),
    RegulatoryProduct.find({ _id: { $in: productIds } }).lean(),
    MedicineSafetySignal.find({ batchNumber }).select("signalType origin severity status score explanation signals sourceRefs evidenceIds correlationId detection resolution createdAt").sort({ createdAt: 1 }).lean(),
    ComplianceLedger.find({ resource: { $in: ["pharmacy_batch", "pharmacy_recall", "medicine_safety_signal"] }, ...(hospital ? { hospital } : {}) }).sort({ createdAt: 1 }).lean(),
  ]);
  const packageData = { batchNumber, suppliers, licenses, products, purchaseOrders, receipts, movements, dispositions, controls, verificationEvents, recalls, safetySignals, ledger };
  return { ...packageData, evidenceHash: hash(packageData) };
}

export function assertAiCannotDecide(action, origin) {
  const forbidden = ["APPROVED", "RELEASED", "SAFE_FOR_CONSUMPTION", "SUPPLIER_SUSPENDED"];
  if (origin === "AI" && forbidden.includes(String(action).toUpperCase())) throw new Error("AI cannot perform regulatory safety decisions");
}
