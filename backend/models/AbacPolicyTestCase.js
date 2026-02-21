import mongoose from "mongoose";

const { Schema, model } = mongoose;

const abacPolicyTestCaseSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    input: {
      domain: { type: String, required: true, trim: true, uppercase: true },
      resource: { type: String, required: true, trim: true },
      action: { type: String, required: true, trim: true },
      role: { type: String, required: true, trim: true, uppercase: true },
      sameHospital: { type: Boolean, default: false },
      hasActiveConsent: { type: Boolean, default: false },
      sourceHospitalBypass: { type: Boolean, default: false },
      allowedScopes: { type: [String], default: [] },
    },
    expected: {
      allowed: { type: Boolean, default: null },
      reason: { type: String, default: "" },
    },
    active: { type: Boolean, default: true, index: true },
    lastRunAt: { type: Date, default: null },
    lastRun: {
      passed: { type: Boolean, default: null },
      allowed: { type: Boolean, default: null },
      reason: { type: String, default: "" },
      matchedPolicyId: { type: Schema.Types.ObjectId, ref: "AbacPolicy", default: null },
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

abacPolicyTestCaseSchema.index(
  { "input.domain": 1, "input.resource": 1, "input.action": 1, "input.role": 1, active: 1 },
  { name: "abac_testcase_lookup_idx" }
);

export default model("AbacPolicyTestCase", abacPolicyTestCaseSchema);

