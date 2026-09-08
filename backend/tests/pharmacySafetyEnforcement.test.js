import mongoose from "mongoose";
import { jest } from "@jest/globals";
import { returnBatchToSupplier, transferBatch, createRecall } from "../controllers/pharmacyTraceabilityController.js";
import PharmacyItem from "../models/PharmacyItem.js";
import PharmacySupplier from "../models/PharmacySupplier.js";
import PharmacyBatchControl from "../models/PharmacyBatchControl.js";
import PharmacyBatchDisposition from "../models/PharmacyBatchDisposition.js";
import PharmacyInventoryMovement from "../models/PharmacyInventoryMovement.js";
import PharmacyRecall from "../models/PharmacyRecall.js";
import setup from "./setupTestEnv.js";

let teardown;

beforeAll(async () => { teardown = await setup(); });
afterAll(async () => { if (teardown) await teardown(); });

beforeEach(async () => {
  await Promise.all([
    PharmacyItem.deleteMany({}),
    PharmacySupplier.deleteMany({}),
    PharmacyBatchControl.deleteMany({}),
    PharmacyBatchDisposition.deleteMany({}),
    PharmacyInventoryMovement.deleteMany({}),
    PharmacyRecall.deleteMany({}),
  ]);
});

function makeRes() {
  const res = { statusCode: 200 };
  res.status = jest.fn().mockImplementation((code) => { res.statusCode = code; return res; });
  res.json = jest.fn().mockImplementation((body) => { res.body = body; return res; });
  return res;
}

async function createHeldBatch(status = "RECALLED") {
  const hospital = new mongoose.Types.ObjectId();
  const supplier = await PharmacySupplier.create({ name: "Safe Return Supplier", hospitals: [hospital] });
  const item = await PharmacyItem.create({ hospital, name: "Held medicine", totalQuantity: 40, batches: [{ batchNumber: "B-1", quantity: 40 }] });
  const control = await PharmacyBatchControl.create({ hospital, itemId: item._id, batchNumber: "B-1", supplier: supplier._id, status, verificationStatus: "QUARANTINED" });
  return { hospital, supplier, item, control };
}

test("recalled batches cannot be transferred", async () => {
  const fixture = await createHeldBatch();
  const res = makeRes();

  await transferBatch({
    body: { itemId: fixture.item._id, batchNumber: "B-1", quantity: 10, destinationHospital: new mongoose.Types.ObjectId(), reason: "Transfer attempt" },
    user: { _id: new mongoose.Types.ObjectId(), hospital: fixture.hospital, role: "PHARMACIST" },
    query: {},
  }, res);

  expect(res.statusCode).toBe(409);
  expect((await PharmacyItem.findById(fixture.item._id)).totalQuantity).toBe(40);
  expect(await PharmacyBatchDisposition.countDocuments({}).exec()).toBe(0);
});

test("recalled batches can be returned through controlled disposition", async () => {
  const fixture = await createHeldBatch();
  const res = makeRes();

  await returnBatchToSupplier({
    body: { itemId: fixture.item._id, batchNumber: "B-1", quantity: 15, reason: "Recall return", evidence: { returnAuthorization: "RA-1" } },
    user: { _id: new mongoose.Types.ObjectId(), hospital: fixture.hospital, role: "PHARMACIST" },
    query: {},
  }, res);

  expect(res.statusCode).toBe(201);
  expect((await PharmacyItem.findById(fixture.item._id)).totalQuantity).toBe(25);
  expect(await PharmacyBatchDisposition.countDocuments({ disposition: "RETURNED" }).exec()).toBe(1);
  expect(await PharmacyInventoryMovement.countDocuments({ movementType: "RETURN" }).exec()).toBe(1);
});

test("duplicate recalls are idempotent and propagate to inventory batches", async () => {
  const fixture = await createHeldBatch("ACTIVE");
  const request = {
    body: { batchNumber: "B-1", reason: "Regulatory recall", authorityReference: "PPB-R-1" },
    user: { _id: new mongoose.Types.ObjectId(), role: "GOVERNMENT_REGULATOR" },
    headers: {},
  };
  const first = makeRes();
  await createRecall(request, first);
  expect(first.statusCode).toBe(201);
  expect((await PharmacyBatchControl.findById(fixture.control._id)).status).toBe("RECALLED");
  expect((await PharmacyItem.findById(fixture.item._id)).batches[0].verificationStatus).toBe("RECALLED");

  const second = makeRes();
  await createRecall(request, second);
  expect(second.statusCode).toBe(200);
  expect(second.body.idempotent).toBe(true);
  expect(await PharmacyRecall.countDocuments({ batchNumber: "B-1" })).toBe(1);
});
