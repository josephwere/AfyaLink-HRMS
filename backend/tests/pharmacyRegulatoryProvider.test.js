import { jest } from "@jest/globals";
import mongoose from "mongoose";
import { verifyProductEvidence } from "../services/pharmacyRegulatoryProvider.js";
import { evaluateDuplicateBatch, evaluatePriceAnomaly } from "../services/medicineSafetyIntelligence.js";
import MedicineSafetySignal from "../models/MedicineSafetySignal.js";
import Notification from "../models/Notification.js";
import { notifyRolesInHospital } from "../services/notificationService.js";
import setup from "./setupTestEnv.js";

let teardown;
beforeAll(async () => { teardown = await setup(); });
afterAll(async () => { if (teardown) await teardown(); });
beforeEach(async () => { await MedicineSafetySignal.deleteMany({}); await Notification.deleteMany({}); delete process.env.PPB_REGISTRY_URL; delete process.env.PPB_API_KEY; });

test("internal registry evidence is never labelled PPB", async () => {
  const result = await verifyProductEvidence({ registrationNumber: "MISSING-LOCAL" });
  expect(result.source).toBe("INTERNAL_REGISTRY");
  expect(result.provider).toBe("INTERNAL_REGISTRY");
});

test("authenticated PPB evidence is recorded and outage fails closed", async () => {
  process.env.PPB_REGISTRY_URL = "https://ppb.test";
  process.env.PPB_API_KEY = "test-key";
  const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({ ok: true, headers: new Headers({ "x-request-id": "ppb-1" }), json: async () => ({ registrationNumber: "PPB-1", status: "ACTIVE" }) });
  const verified = await verifyProductEvidence({ registrationNumber: "PPB-1" });
  expect(verified.source).toBe("PPB_API");
  expect(verified.requestId).toBe("ppb-1");
  fetchSpy.mockRejectedValue(new Error("network down"));
  const unavailable = await verifyProductEvidence({ registrationNumber: "PPB-2" });
  expect(unavailable.responseStatus).toBe("UNAVAILABLE");
  expect(unavailable.product).toBeNull();
  fetchSpy.mockRestore();
});

test("malformed PPB responses fail closed instead of becoming internal or verified evidence", async () => {
  process.env.PPB_REGISTRY_URL = "https://ppb.test";
  process.env.PPB_API_KEY = "test-key";
  const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({ ok: true, headers: new Headers(), json: async () => ({ result: "unexpected" }) });
  const result = await verifyProductEvidence({ registrationNumber: "PPB-MALFORMED", now: new Date(Date.now() + 20000) });
  expect(result.source).toBe("PPB_API");
  expect(result.responseStatus).toBe("UNAVAILABLE");
  expect(result.providerError).toBe("PPB_INVALID_RESPONSE");
  fetchSpy.mockRestore();
});

test("pricing and cross-hospital duplicate batch anomalies create reproducible signals", async () => {
  const price = await evaluatePriceAnomaly({ itemId: new mongoose.Types.ObjectId(), unitPrice: 10, baselinePrices: [20, 21, 19] });
  expect(price.signal.signalType).toBe("PRICE_ANOMALY");
  const duplicate = await evaluateDuplicateBatch({ batchNumber: "DUP-1", controls: [{ _id: new mongoose.Types.ObjectId(), hospital: new mongoose.Types.ObjectId() }, { _id: new mongoose.Types.ObjectId(), hospital: new mongoose.Types.ObjectId() }] });
  expect(duplicate.signal.signalType).toBe("DUPLICATE_BATCH_NUMBER");
  expect(duplicate.signal.confidence).toBe(90);
});

test("high-risk signal notifications are idempotent per recipient", async () => {
  const hospital = new mongoose.Types.ObjectId();
  const user = new mongoose.Types.ObjectId();
  const User = (await import("../models/User.js")).default;
  await User.create({ _id: user, name: "Safety Reviewer", email: `safety-${user}@example.com`, role: "PHARMACIST", hospital, active: true, password: "hashed" });
  const first = await notifyRolesInHospital({ hospital, roles: ["PHARMACIST"], title: "Safety alert", body: "Review required", category: "PHARMACY_SAFETY", meta: { idempotencyKey: "signal:test-1" } });
  const second = await notifyRolesInHospital({ hospital, roles: ["PHARMACIST"], title: "Safety alert", body: "Review required", category: "PHARMACY_SAFETY", meta: { idempotencyKey: "signal:test-1" } });
  expect(first).toHaveLength(1);
  expect(second).toHaveLength(0);
  expect(await Notification.countDocuments({ hospital })).toBe(1);
});