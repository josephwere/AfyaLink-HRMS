import mongoose from "mongoose";
import { jest } from "@jest/globals";
import { receivePurchaseOrder, recordSupplierPayment } from "../controllers/pharmacyProcurementController.js";
import { reserveStock } from "../controllers/pharmacyInventoryController.js";
import { createRecall, updateRecall, acknowledgeRecall, destroyBatch, getRecallReconciliation, getRecallEvidence } from "../controllers/pharmacyTraceabilityController.js";
import PharmacyItem from "../models/PharmacyItem.js";
import PharmacySupplier from "../models/PharmacySupplier.js";
import SupplierLicense from "../models/SupplierLicense.js";
import PharmacyPurchaseOrder from "../models/PharmacyPurchaseOrder.js";
import PharmacyShipment from "../models/PharmacyShipment.js";
import PharmacyGoodsReceipt from "../models/PharmacyGoodsReceipt.js";
import PharmacyInventoryMovement from "../models/PharmacyInventoryMovement.js";
import PharmacyRecall from "../models/PharmacyRecall.js";
import PharmacyBatchDisposition from "../models/PharmacyBatchDisposition.js";
import PharmacyVerificationEvent from "../models/PharmacyVerificationEvent.js";
import PharmacyRecallDiscrepancy from "../models/PharmacyRecallDiscrepancy.js";
import PharmacySupplierInvoice from "../models/PharmacySupplierInvoice.js";
import PharmacySupplierPayment from "../models/PharmacySupplierPayment.js";
import MedicineSafetySignal from "../models/MedicineSafetySignal.js";
import Notification from "../models/Notification.js";
import ComplianceLedger from "../models/ComplianceLedger.js";
import User from "../models/User.js";
import setup from "./setupTestEnv.js";

let teardown;
let fetchSpy;
beforeAll(async () => { teardown = await setup(); });
afterAll(async () => { fetchSpy?.mockRestore(); if (teardown) await teardown(); });
beforeEach(async () => {
  fetchSpy?.mockRestore();
  process.env.PPB_REGISTRY_URL = "https://ppb.drill.test";
  process.env.PPB_API_KEY = "drill-key";
  fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({ ok: true, headers: new Headers({ "x-request-id": "ppb-drill-1" }), json: async () => ({ registrationNumber: "PPB-DRILL-1", status: "ACTIVE", manufacturer: "Drill Pharma" }) });
  await Promise.all([
    PharmacyItem.deleteMany({}), PharmacySupplier.deleteMany({}), SupplierLicense.deleteMany({}), PharmacyPurchaseOrder.deleteMany({}), PharmacyShipment.deleteMany({}), PharmacyGoodsReceipt.deleteMany({}), PharmacyInventoryMovement.deleteMany({}), PharmacyRecall.deleteMany({}), PharmacyBatchDisposition.deleteMany({}), PharmacyVerificationEvent.deleteMany({}), PharmacyRecallDiscrepancy.deleteMany({}), PharmacySupplierInvoice.deleteMany({}), PharmacySupplierPayment.deleteMany({}), MedicineSafetySignal.deleteMany({}), Notification.deleteMany({}), User.deleteMany({}),
  ]);
});

function makeRes() {
  const res = { statusCode: 200 };
  res.status = jest.fn().mockImplementation((code) => { res.statusCode = code; return res; });
  res.json = jest.fn().mockImplementation((body) => { res.body = body; return res; });
  return res;
}

function user(_id, hospital, role) { return { _id, hospital, role }; }

test("runs the PPB-to-closure safety drill with enforcement and idempotency", async () => {
  const hospital = new mongoose.Types.ObjectId();
  const supplierUser = new mongoose.Types.ObjectId();
  const pharmacist = new mongoose.Types.ObjectId();
  const regulator = new mongoose.Types.ObjectId();
  await User.create([
    { _id: pharmacist, name: "Drill Pharmacist", email: `pharmacist-${pharmacist}@example.com`, password: "hashed", role: "PHARMACIST", hospital, active: true },
    { _id: new mongoose.Types.ObjectId(), name: "Drill Admin", email: "drill-admin@example.com", password: "hashed", role: "HOSPITAL_ADMIN", hospital, active: true },
  ]);
  const supplier = await PharmacySupplier.create({ name: "Drill Supplier", hospitals: [hospital], users: [supplierUser], regulatoryStatus: "ACTIVE" });
  await SupplierLicense.create({ supplier: supplier._id, licenseNumber: "LIC-DRILL", status: "ACTIVE" });
  const item = await PharmacyItem.create({ hospital, name: "Drill medicine", totalQuantity: 0, batches: [] });
  const order = await PharmacyPurchaseOrder.create({ hospital, supplier: supplier._id, status: "SHIPPED", items: [{ itemId: item._id, name: item.name, quantity: 100, unitCost: 12 }], totalAmount: 1200 });
  const shipment = await PharmacyShipment.create({ purchaseOrder: order._id, hospital, supplier: supplier._id, status: "DISPATCHED", items: [{ itemId: item._id, quantity: 100, batchNumber: "DRILL-BATCH" }] });
  const receivingRes = makeRes();
  await receivePurchaseOrder({ params: { id: order._id }, body: { shipmentId: shipment._id, items: [{ itemId: item._id, receivedQuantity: 100, batchNumber: "DRILL-BATCH", registrationNumber: "PPB-DRILL-1", manufacturer: "Drill Pharma" }] }, user: user(pharmacist, hospital, "PHARMACIST"), query: {} }, receivingRes);
  expect(receivingRes.statusCode).toBe(201);
  expect((await PharmacyVerificationEvent.findOne()).evidenceSource).toBe("PPB_API");
  expect((await PharmacyGoodsReceipt.findOne()).items[0].receivedQuantity).toBe(100);

  const invoice = await PharmacySupplierInvoice.create({ purchaseOrder: order._id, hospital, supplier: supplier._id, invoiceNumber: "INV-DRILL", amount: 1200 });
  const recallRes = makeRes();
  const recallRequest = { body: { batchNumber: "DRILL-BATCH", registrationNumber: "PPB-DRILL-1", reason: "Drill recall", authorityReference: "PPB-DRILL-R" }, user: user(regulator, null, "GOVERNMENT_REGULATOR"), headers: {} };
  await createRecall(recallRequest, recallRes);
  expect(recallRes.statusCode).toBe(201);
  const recall = await PharmacyRecall.findById(recallRes.body.recall._id);
  expect(recall.status).toBe("ACTIVE");
  expect((await PharmacyBatchDisposition.countDocuments({}))).toBe(0);
  expect(await MedicineSafetySignal.countDocuments({ signalType: "POTENTIAL_RECALL_IMPACT" })).toBe(1);
  expect(await Notification.countDocuments({ category: "PHARMACY_SAFETY" })).toBeGreaterThanOrEqual(2);

  const duplicateRecall = makeRes();
  await createRecall(recallRequest, duplicateRecall);
  expect(duplicateRecall.body.idempotent).toBe(true);
  expect(await PharmacyRecall.countDocuments({ batchNumber: "DRILL-BATCH" })).toBe(1);

  const hospitalAck = makeRes();
  await acknowledgeRecall({ params: { id: recall._id }, body: { note: "Received and contained" }, user: user(pharmacist, hospital, "PHARMACIST"), query: {} }, hospitalAck);
  expect(hospitalAck.statusCode).toBe(201);
  const blockedDispense = makeRes();
  await reserveStock({ params: { id: item._id }, body: { quantity: 1, batchNumber: "DRILL-BATCH" }, user: user(pharmacist, hospital, "PHARMACIST"), query: {} }, blockedDispense);
  expect(blockedDispense.statusCode).toBe(409);
  const blockedPayment = makeRes();
  await recordSupplierPayment({ body: { invoiceId: invoice._id, amount: 1200 }, user: user(pharmacist, hospital, "PHARMACIST"), query: {} }, blockedPayment);
  expect(blockedPayment.statusCode).toBe(409);
  expect((await PharmacySupplierInvoice.findById(invoice._id)).status).toBe("ISSUED");

  const unauthorized = makeRes();
  await updateRecall({ params: { id: recall._id }, body: { status: "CLOSED" }, user: user(new mongoose.Types.ObjectId(), hospital, "AI") }, unauthorized);
  expect(unauthorized.statusCode).toBe(403);
  expect((await PharmacyRecall.findById(recall._id)).status).toBe("ACTIVE");

  const destroyRes = makeRes();
  await destroyBatch({ body: { itemId: item._id, batchNumber: "DRILL-BATCH", quantity: 100, reason: "Witnessed destruction", evidence: { certificate: "DEST-DRILL" } }, user: user(pharmacist, hospital, "PHARMACIST"), query: {}, headers: {} }, destroyRes);
  expect(destroyRes.statusCode).toBe(201);
  const reconciliationRes = makeRes();
  await getRecallReconciliation({ params: { id: recall._id }, user: user(regulator, null, "GOVERNMENT_REGULATOR") }, reconciliationRes);
  expect(reconciliationRes.body.totals).toMatchObject({ received: 100, destroyed: 100, confirmedQuantity: 0, missingQuantity: 0 });
  expect(reconciliationRes.body.closure.allowed).toBe(true);

  const evidenceRes = makeRes();
  await getRecallEvidence({ params: { id: recall._id }, user: user(regulator, null, "GOVERNMENT_REGULATOR") }, evidenceRes);
  const evidenceAgainRes = makeRes();
  await getRecallEvidence({ params: { id: recall._id }, user: user(regulator, null, "GOVERNMENT_REGULATOR") }, evidenceAgainRes);
  expect(evidenceRes.body.evidenceHash).toBe(evidenceAgainRes.body.evidenceHash);
  expect(evidenceRes.body.recordCounts).toMatchObject({ shipments: 1, receipts: 1, movements: 2, dispositions: 1 });

  const closeRes = makeRes();
  await updateRecall({ params: { id: recall._id }, body: { status: "CLOSED" }, user: user(regulator, null, "GOVERNMENT_REGULATOR") }, closeRes);
  expect(closeRes.statusCode).toBe(200);
  expect(closeRes.body.status).toBe("CLOSED");
  expect(await ComplianceLedger.countDocuments({ action: "PHARMACY_RECALL_CLOSED", resourceId: recall._id })).toBe(1);
});
