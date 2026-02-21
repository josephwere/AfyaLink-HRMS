import mongoose from "mongoose";

const { Schema, model } = mongoose;

const riskPolicySchema = new Schema(
  {
    key: { type: String, default: "GLOBAL", unique: true, index: true },
    enabled: { type: Boolean, default: true },
    thresholds: {
      medium: { type: Number, default: 40 },
      high: { type: Number, default: 70 },
      critical: { type: Number, default: 90 },
    },
    scores: {
      missingDeviceFingerprint: { type: Number, default: 15 },
      newDevice: { type: Number, default: 30 },
      userAgentChanged: { type: Number, default: 10 },
      newNetworkPrefix: { type: Number, default: 35 },
      impossibleTravel: { type: Number, default: 45 },
    },
    impossibleTravelWindowMinutes: { type: Number, default: 90 },
    restrictionMinutes: { type: Number, default: 30 },
    stepUpWindowMinutes: { type: Number, default: 15 },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default model("RiskPolicy", riskPolicySchema);

