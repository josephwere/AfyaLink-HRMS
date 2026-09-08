import { jest } from "@jest/globals";
import mongoose from "mongoose";
import ComplianceLedger from "../models/ComplianceLedger.js";
import { appendComplianceLedger, verifyComplianceLedger } from "../utils/complianceLedger.js";
import setup from "./setupTestEnv.js";

let teardown;
beforeAll(async () => { teardown = await setup(); });
afterAll(async () => { if (teardown) await teardown(); });

function forceTamper(entryId, entryHash) {
  return ComplianceLedger.collection.updateOne({ _id: entryId }, { $set: { entryHash } });
}

test("ledger integrity verification accepts a valid append-only chain", async () => {
  const hospital = new mongoose.Types.ObjectId();
  await appendComplianceLedger({ actorId: new mongoose.Types.ObjectId(), actorRole: "GOVERNMENT_REGULATOR", action: "DRILL_EVENT", resource: "drill", resourceId: new mongoose.Types.ObjectId(), hospital, metadata: { correlationId: "ledger-drill-1" } });
  const result = await verifyComplianceLedger({ tenantKey: `hospital:${hospital}` });
  expect(result.ok).toBe(true);
  expect(result.checked).toBe(1);
});

test("ledger integrity verification detects tampering", async () => {
  const hospital = new mongoose.Types.ObjectId();
  const entry = await appendComplianceLedger({ actorId: new mongoose.Types.ObjectId(), actorRole: "GOVERNMENT_REGULATOR", action: "DRILL_EVENT", resource: "drill", resourceId: new mongoose.Types.ObjectId(), hospital, metadata: { correlationId: "ledger-drill-2" } });
  await forceTamper(entry._id, "tampered");
  const result = await verifyComplianceLedger({ tenantKey: `hospital:${hospital}` });
  expect(result.ok).toBe(false);
  expect(result.failures.some((failure) => failure.reason === "HASH_MISMATCH")).toBe(true);
});
