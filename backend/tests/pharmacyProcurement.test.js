import mongoose from "mongoose";
import { jest } from "@jest/globals";
import { receivePurchaseOrder } from "../controllers/pharmacyProcurementController.js";
import PharmacyItem from "../models/PharmacyItem.js";
import PharmacyPurchaseOrder from "../models/PharmacyPurchaseOrder.js";
import PharmacySupplier from "../models/PharmacySupplier.js";
import PharmacyGoodsReceipt from "../models/PharmacyGoodsReceipt.js";
import PharmacyInventoryMovement from "../models/PharmacyInventoryMovement.js";
import RegulatoryProduct from "../models/RegulatoryProduct.js";
import SupplierLicense from "../models/SupplierLicense.js";
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
    PharmacyPurchaseOrder.deleteMany({}),
    PharmacySupplier.deleteMany({}),
    PharmacyGoodsReceipt.deleteMany({}),
    PharmacyInventoryMovement.deleteMany({}),
    RegulatoryProduct.deleteMany({}),
    SupplierLicense.deleteMany({}),
  ]);
});

function makeRes() {
  const res = { statusCode: 200 };
  res.status = jest.fn().mockImplementation((code) => { res.statusCode = code; return res; });
  res.json = jest.fn().mockImplementation((body) => { res.body = body; return res; });
  return res;
}

test("receiving is the only procurement boundary that updates pharmacy stock", async () => {
  const hospital = new mongoose.Types.ObjectId();
  const supplier = await PharmacySupplier.create({ name: "MedSupply", hospitals: [hospital] });
  await SupplierLicense.create({ supplier: supplier._id, licenseNumber: "PPB-MED-001", status: "ACTIVE" });
  const product = await RegulatoryProduct.create({ registrationNumber: "PPB-AMD-500", tradeName: "Amoxicillin 500mg", activeIngredient: "Amoxicillin", manufacturer: "ACME Pharma", status: "ACTIVE" });
  const item = await PharmacyItem.create({ hospital, name: "Amoxicillin 500mg", totalQuantity: 10, batches: [{ batchNumber: "OLD", quantity: 10 }] });
  const order = await PharmacyPurchaseOrder.create({
    hospital,
    supplier: supplier._id,
    status: "SHIPPED",
    items: [{ itemId: item._id, name: item.name, quantity: 100, unitCost: 8.4 }],
    totalAmount: 840,
  });
  const req = {
    params: { id: order._id.toString() },
    body: { items: [{ itemId: item._id, receivedQuantity: 95, batchNumber: "NEW", expiryDate: "2027-08-31", registrationNumber: product.registrationNumber, manufacturer: product.manufacturer, scannedCode: "PPB-AMD-500:NEW" }] },
    user: { _id: new mongoose.Types.ObjectId(), hospital, role: "PHARMACIST" },
    query: {},
  };
  const res = makeRes();

  await receivePurchaseOrder(req, res);

  expect(res.statusCode).toBe(201);
  expect((await PharmacyItem.findById(item._id)).totalQuantity).toBe(105);
  expect(await PharmacyInventoryMovement.countDocuments({ referenceType: "PURCHASE_ORDER" })).toBe(1);

  const duplicateRes = makeRes();
  await receivePurchaseOrder(req, duplicateRes);
  expect(duplicateRes.statusCode).toBe(409);
  expect((await PharmacyItem.findById(item._id)).totalQuantity).toBe(105);
});

test("unverified batches are quarantined before goods receipt", async () => {
  const hospital = new mongoose.Types.ObjectId();
  const supplier = await PharmacySupplier.create({ name: "Unverified Supplier", hospitals: [hospital] });
  const item = await PharmacyItem.create({ hospital, name: "Ceftriaxone 1g", totalQuantity: 10, batches: [{ batchNumber: "OLD", quantity: 10 }] });
  const order = await PharmacyPurchaseOrder.create({
    hospital,
    supplier: supplier._id,
    status: "SHIPPED",
    items: [{ itemId: item._id, name: item.name, quantity: 50, unitCost: 20 }],
    totalAmount: 1000,
  });
  const res = makeRes();

  await receivePurchaseOrder({
    params: { id: order._id.toString() },
    body: { items: [{ itemId: item._id, receivedQuantity: 50, batchNumber: "UNKNOWN" }] },
    user: { _id: new mongoose.Types.ObjectId(), hospital, role: "PHARMACIST" },
    query: {},
  }, res);

  expect(res.statusCode).toBe(422);
  expect((await PharmacyItem.findById(item._id)).totalQuantity).toBe(10);
  expect(await PharmacyGoodsReceipt.countDocuments({ purchaseOrder: order._id })).toBe(0);
});
