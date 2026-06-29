import mongoose from "mongoose";
import { jest } from "@jest/globals";
import { reserveStock, dispenseStock } from "../controllers/pharmacyInventoryController.js";
import PharmacyItem from "../models/PharmacyItem.js";
import PharmacyReservation from "../models/PharmacyReservation.js";
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
    PharmacyReservation.deleteMany({}),
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

describe("pharmacy reservation workflow", () => {
  test("reserves and fulfills stock through a reservation before dispensing", async () => {
    const hospitalId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();

    const item = await PharmacyItem.create({
      hospital: hospitalId,
      name: "Paracetamol",
      batches: [{ batchNumber: "B-001", quantity: 20, expiryDate: "2026-12-01" }],
      totalQuantity: 20,
    });

    const reserveReq = {
      params: { id: item._id.toString() },
      body: { quantity: 8, batchNumber: "B-001", prescriptionId: new mongoose.Types.ObjectId().toString() },
      user: { _id: userId, hospital: hospitalId },
      query: {},
    };
    const reserveRes = makeRes();
    await reserveStock(reserveReq, reserveRes);

    expect(reserveRes.statusCode).toBe(201);
    const reservation = await PharmacyReservation.findOne({ itemId: item._id });
    expect(reservation.status).toBe("ACTIVE");

    const dispenseReq = {
      params: { id: item._id.toString() },
      body: { reservationId: reservation._id.toString(), quantity: 8 },
      user: { _id: userId, hospital: hospitalId },
      query: {},
    };
    const dispenseRes = makeRes();
    await dispenseStock(dispenseReq, dispenseRes);

    expect(dispenseRes.statusCode).toBe(200);
    const updatedReservation = await PharmacyReservation.findById(reservation._id);
    expect(updatedReservation.status).toBe("FULFILLED");
    const updatedItem = await PharmacyItem.findById(item._id);
    expect(updatedItem.totalQuantity).toBe(12);
    const movements = await PharmacyInventoryMovement.find({ itemId: item._id });
    expect(movements.some((movement) => movement.movementType === "DISPENSE")).toBe(true);
  });
});
