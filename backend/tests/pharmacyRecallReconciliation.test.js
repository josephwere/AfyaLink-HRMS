import mongoose from "mongoose";
import { jest } from "@jest/globals";
import PharmacyItem from "../models/PharmacyItem.js";
import PharmacyBatchControl from "../models/PharmacyBatchControl.js";
import PharmacyInventoryMovement from "../models/PharmacyInventoryMovement.js";
import PharmacyRecall from "../models/PharmacyRecall.js";
import PharmacyRecallDiscrepancy from "../models/PharmacyRecallDiscrepancy.js";
import { deriveRecallReconciliation, upsertDerivedDiscrepancies, closureDecision, buildRecallEvidencePackage } from "../services/pharmacyRecallReconciliationService.js";
import { updateRecall, resolveRecallDiscrepancy, acknowledgeRecall, submitRecallReconciliation } from "../controllers/pharmacyTraceabilityController.js";
import setup from "./setupTestEnv.js";

let teardown;
beforeAll(async () => { teardown = await setup(); });
afterAll(async () => { if (teardown) await teardown(); });
beforeEach(async () => {
  await Promise.all([
    PharmacyItem.deleteMany({}),
    PharmacyBatchControl.deleteMany({}),
    PharmacyInventoryMovement.deleteMany({}),
    PharmacyRecall.deleteMany({}),
    PharmacyRecallDiscrepancy.deleteMany({}),
  ]);
});

function makeRes() {
  const res = { statusCode: 200 };
  res.status = jest.fn().mockImplementation((code) => { res.statusCode = code; return res; });
  res.json = jest.fn().mockImplementation((body) => { res.body = body; return res; });
  return res;
}

test("derives a missing five-unit discrepancy and blocks then permits regulator closure", async () => {
  const hospital = new mongoose.Types.ObjectId();
  const actor = new mongoose.Types.ObjectId();
  const item = await PharmacyItem.create({ hospital, name: "Recall medicine", totalQuantity: 90, batches: [{ batchNumber: "B-E2E", quantity: 90 }] });
  const control = await PharmacyBatchControl.create({ hospital, itemId: item._id, batchNumber: "B-E2E", status: "RECALLED", verificationStatus: "QUARANTINED" });
  await PharmacyInventoryMovement.create([
    { itemId: item._id, hospital, movementType: "RECEIPT", batchNumber: "B-E2E", quantity: 100, previousQuantity: 0, newQuantity: 100, performedBy: actor },
    { itemId: item._id, hospital, movementType: "DISPENSE", batchNumber: "B-E2E", quantity: 5, previousQuantity: 100, newQuantity: 95, performedBy: actor },
  ]);
  const recall = await PharmacyRecall.create({ batchNumber: "B-E2E", reason: "E2E regulatory recall", status: "ACTIVE", createdBy: actor });

  const first = await upsertDerivedDiscrepancies(recall);
  expect(first.totals).toMatchObject({ received: 100, dispensed: 5, expectedQuantity: 95, confirmedQuantity: 90, missingQuantity: 5 });
  expect(first.completeness).toBe("TRACE_PARTIAL");
  const discrepancy = await PharmacyRecallDiscrepancy.findOne({ recallId: recall._id });
  expect(discrepancy).toMatchObject({ expectedQuantity: 95, confirmedQuantity: 90, missingQuantity: 5, status: "OPEN" });

  const acknowledged = makeRes();
  await acknowledgeRecall({ params: { id: recall._id }, body: { note: "Recall received" }, user: { _id: actor, hospital, role: "HOSPITAL_ADMIN" }, query: {} }, acknowledged);
  expect(acknowledged.statusCode).toBe(201);
  const submitted = makeRes();
  await submitRecallReconciliation({ params: { id: recall._id }, body: { confirmedQuantity: 90, evidence: { countSheet: "COUNT-1" } }, user: { _id: actor, hospital, role: "HOSPITAL_ADMIN" }, query: {} }, submitted);
  expect(submitted.statusCode).toBe(200);

  const blocked = makeRes();
  await updateRecall({ params: { id: recall._id }, body: { status: "CLOSED" }, user: { _id: actor, role: "GOVERNMENT_REGULATOR" } }, blocked);
  expect(blocked.statusCode).toBe(409);
  expect(blocked.body.code).toBe("RECALL_CLOSURE_BLOCKED");
  expect(blocked.body.reasons).toContain("UNRESOLVED_DISCREPANCIES");

  const resolved = makeRes();
  await resolveRecallDiscrepancy({ params: { id: discrepancy._id }, body: { reason: "Five units destroyed under regulator witness", evidence: { certificate: "DEST-5" } }, user: { _id: actor, role: "GOVERNMENT_REGULATOR" } }, resolved);
  expect(resolved.statusCode).toBe(200);

  await PharmacyItem.updateOne({ _id: item._id }, { $set: { totalQuantity: 95, "batches.0.quantity": 95 } });
  const finalReport = await deriveRecallReconciliation(await PharmacyRecall.findById(recall._id).lean());
  expect(closureDecision(finalReport).allowed).toBe(true);

  const closed = makeRes();
  await updateRecall({ params: { id: recall._id }, body: { status: "CLOSED" }, user: { _id: actor, role: "GOVERNMENT_REGULATOR" } }, closed);
  expect(closed.statusCode).toBe(200);
  expect(closed.body.status).toBe("CLOSED");

  const evidenceOne = await buildRecallEvidencePackage(closed.body);
  const evidenceTwo = await buildRecallEvidencePackage(closed.body);
  expect(evidenceOne.evidenceHash).toBe(evidenceTwo.evidenceHash);
  expect(await PharmacyRecall.countDocuments({ status: "CLOSED" })).toBe(1);
  expect(control._id).toBeDefined();
});
