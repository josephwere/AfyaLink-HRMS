import mongoose from "mongoose";
import { jest } from "@jest/globals";
import { createRiskSignal, assertAiCannotDecide, buildEvidencePackage } from "../services/medicineSafetyIntelligence.js";
import { transitionSafetySignal, applyRegulatoryAction, getInvestigationReport } from "../controllers/pharmacyTraceabilityController.js";
import MedicineSafetySignal from "../models/MedicineSafetySignal.js";
import PharmacyVerificationEvent from "../models/PharmacyVerificationEvent.js";
import PharmacyRecall from "../models/PharmacyRecall.js";
import PharmacyBatchControl from "../models/PharmacyBatchControl.js";
import setup from "./setupTestEnv.js";

let teardown;
beforeAll(async () => { teardown = await setup(); });
afterAll(async () => { if (teardown) await teardown(); });
beforeEach(async () => {
  await Promise.all([
    MedicineSafetySignal.deleteMany({}),
    PharmacyVerificationEvent.deleteMany({}),
    PharmacyRecall.deleteMany({}),
    PharmacyBatchControl.deleteMany({}),
  ]);
});

function makeRes() {
  const res = { statusCode: 200 };
  res.status = jest.fn().mockImplementation((code) => { res.statusCode = code; return res; });
  res.json = jest.fn().mockImplementation((body) => { res.body = body; return res; });
  return res;
}

test("AI risk signals cannot become release decisions", async () => {
  const signalResult = await createRiskSignal({ signalType: "PRICE_ANOMALY", origin: "AI", score: 90, explanation: "Price is below baseline.", signals: ["PRICE_BELOW_MEDIAN"] });
  expect(signalResult.signal.status).toBe("OPEN");
  expect(() => assertAiCannotDecide("RELEASED", "AI")).toThrow("AI cannot perform regulatory safety decisions");
  const res = makeRes();
  await transitionSafetySignal({ params: { id: signalResult.signal._id }, body: { status: "ACKNOWLEDGED" }, user: { _id: new mongoose.Types.ObjectId(), role: "HOSPITAL_ADMIN" }, headers: {} }, res);
  expect(res.statusCode).toBe(403);
});

test("authorized regulator lifecycle transitions are audited and evidence hashes change", async () => {
  const hospital = new mongoose.Types.ObjectId();
  const itemId = new mongoose.Types.ObjectId();
  const actor = new mongoose.Types.ObjectId();
  const event = await PharmacyVerificationEvent.create({ hospital, itemId, batchNumber: "B-9", scannedBy: actor, correlationId: "corr-9", result: "QUARANTINED", riskSignals: ["REGISTRATION_NOT_FOUND"], evidenceHash: "hash-a" });
  await PharmacyBatchControl.create({ hospital, itemId, batchNumber: "B-9", verificationStatus: "QUARANTINED", status: "QUARANTINED" });
  const signalResult = await createRiskSignal({ signalType: "VERIFICATION_FAILURE", origin: "RULE", score: 80, explanation: "Batch failed verification.", signals: event.riskSignals, hospital, itemId, batchNumber: "B-9", evidenceIds: [String(event._id)], correlationId: event.correlationId });
  const res = makeRes();
  await transitionSafetySignal({ params: { id: signalResult.signal._id }, body: { status: "ACKNOWLEDGED", reason: "Reviewed" }, user: { _id: actor, role: "GOVERNMENT_REGULATOR" }, headers: {} }, res);
  expect(res.statusCode).toBe(200);
  const first = await buildEvidencePackage({ batchNumber: "B-9" });
  await PharmacyVerificationEvent.updateOne({ _id: event._id }, { $set: { evidenceHash: "hash-b" } });
  const second = await buildEvidencePackage({ batchNumber: "B-9" });
  expect(first.evidenceHash).not.toBe(second.evidenceHash);
});

test("AI cannot directly execute regulatory actions and unauthorized users are blocked", async () => {
  const res = makeRes();
  await applyRegulatoryAction({
    body: { action: "SUSPEND_SUPPLIER", supplierId: new mongoose.Types.ObjectId().toString(), reason: "AI detection", evidence: ["e1"], correlationId: "corr-action-1" },
    user: { _id: new mongoose.Types.ObjectId(), role: "AI" },
    headers: {},
  }, res);
  expect(res.statusCode).toBe(403);

  const badUser = makeRes();
  await applyRegulatoryAction({
    body: { action: "SUSPEND_SUPPLIER", supplierId: new mongoose.Types.ObjectId().toString(), reason: "Bad user", evidence: ["e1"], correlationId: "corr-action-2" },
    user: { _id: new mongoose.Types.ObjectId(), role: "PHARMACIST" },
    headers: {},
  }, badUser);
  expect(badUser.statusCode).toBe(403);
});

test("investigation reports are privacy-safe and exclude patient identifiers", async () => {
  const hospital = new mongoose.Types.ObjectId();
  const batchNumber = "B-INV-1";
  const signal = await MedicineSafetySignal.create({
    signalType: "POTENTIAL_RECALL_IMPACT",
    origin: "REGULATORY",
    score: 80,
    severity: "HIGH",
    status: "OPEN",
    explanation: "Review required",
    hospital,
    batchNumber,
    correlationId: "corr-investigation",
    evidenceIds: ["evidence-1"],
    sourceRefs: [{ resource: "pharmacy_batch_control", resourceId: "control-1", correlationId: "corr-investigation" }],
  });

  const res = makeRes();
  await getInvestigationReport({ params: { id: signal._id.toString(), type: "alert" }, user: { _id: new mongoose.Types.ObjectId(), role: "GOVERNMENT_REGULATOR" }, headers: {} }, res);

  expect(res.statusCode).toBe(200);
  expect(res.body.privacy?.identifiersExcluded).toBe(true);
  expect(JSON.stringify(res.body)).not.toContain("patient");
});
