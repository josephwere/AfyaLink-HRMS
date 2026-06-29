import mongoose from "mongoose";
import { jest } from "@jest/globals";
import { createItem, addStock, reserveStock, dispenseStock } from "../controllers/pharmacyInventoryController.js";
import PharmacyItem from "../models/PharmacyItem.js";
import PharmacyInventoryMovement from "../models/PharmacyInventoryMovement.js";
import setup from "./setupTestEnv.js";

let teardown;

beforeAll(async () => {
  teardown = await setup();
});

afterAll(async () => {
  if (teardown) await teardown();
});

beforeEach(async () => {
  await Promise.all([
    PharmacyItem.deleteMany({}),
    PharmacyInventoryMovement.deleteMany({}),
  ]);
});

function makeRes() {
  const res = {};
  res.statusCode = 200;
  res.status = jest.fn().mockImplementation((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn().mockImplementation((body) => {
    res.body = body;
    return res;
  });
  return res;
}

describe("pharmacy inventory workflow", () => {
  test("captures catalog metadata and stock movement history", async () => {
    const hospitalId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();

    const createReq = {
      body: {
        name: "Amoxicillin",
        genericName: "Amoxicillin trihydrate",
        therapeuticClass: "Antibiotic",
        storageLocation: "Cold room A",
        controlledDrug: false,
        batches: [{ batchNumber: "B1", quantity: 10, expiryDate: "2026-12-01" }],
      },
      user: { _id: userId, hospital: hospitalId },
      query: {},
      params: {},
    };

    const createRes = makeRes();
    await createItem(createReq, createRes);

    expect(createRes.statusCode).toBe(201);
    expect(createRes.body.genericName).toBe("Amoxicillin trihydrate");
    expect(createRes.body.therapeuticClass).toBe("Antibiotic");
    expect(createRes.body.storageLocation).toBe("Cold room A");

    const item = await PharmacyItem.findById(createRes.body._id);
    expect(item).toBeTruthy();

    const addReq = {
      params: { id: item._id.toString() },
      body: { quantity: 5, batchNumber: "B2", expiryDate: "2027-01-01" },
      user: { _id: userId, hospital: hospitalId },
      query: {},
    };
    const addRes = makeRes();
    await addStock(addReq, addRes);

    expect(addRes.statusCode).toBe(200);
    const movements = await PharmacyInventoryMovement.find({ itemId: item._id }).lean();
    expect(movements.some((movement) => movement.movementType === "RECEIPT")).toBe(true);

    const reserveReq = {
      params: { id: item._id.toString() },
      body: { quantity: 6, batchNumber: "B1", note: "Patient dispense" },
      user: { _id: userId, hospital: hospitalId },
      query: {},
    };
    const reserveRes = makeRes();
    await reserveStock(reserveReq, reserveRes);

    expect(reserveRes.statusCode).toBe(201);
    expect(reserveRes.body.status).toBe("ACTIVE");

    const dispenseReq = {
      params: { id: item._id.toString() },
      body: { reservationId: reserveRes.body._id.toString(), quantity: 6, note: "Dispensing medication" },
      user: { _id: userId, hospital: hospitalId },
      query: {},
    };
    const dispenseRes = makeRes();
    await dispenseStock(dispenseReq, dispenseRes);

    expect(dispenseRes.statusCode).toBe(200);
    const movementRecords = await PharmacyInventoryMovement.find({ itemId: item._id }).lean();
    expect(movementRecords.some((movement) => movement.movementType === "DISPENSE")).toBe(true);
    expect(movementRecords.some((movement) => movement.batchNumber === "B1")).toBe(true);
  });
});
