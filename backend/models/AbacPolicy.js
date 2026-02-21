import mongoose from "mongoose";

const { Schema, model } = mongoose;

const abacPolicySchema = new Schema(
  {
    domain: { type: String, required: true, trim: true, index: true },
    resource: { type: String, required: true, trim: true, index: true },
    action: { type: String, required: true, trim: true, index: true },
    effect: { type: String, enum: ["ALLOW", "DENY"], default: "ALLOW", index: true },
    roles: { type: [String], default: [] },
    conditions: {
      requireActiveConsent: { type: Boolean, default: false },
      requireSameHospitalOrPrivileged: { type: Boolean, default: false },
      requiredScopes: { type: [String], default: [] },
    },
    priority: { type: Number, default: 100, index: true },
    active: { type: Boolean, default: true, index: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

abacPolicySchema.index(
  { domain: 1, resource: 1, action: 1, priority: 1, active: 1 },
  { name: "abac_lookup_idx" }
);

export default model("AbacPolicy", abacPolicySchema);

