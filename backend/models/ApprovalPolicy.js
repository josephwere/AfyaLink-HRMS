import mongoose from "mongoose";
const { Schema, model } = mongoose;

const approvalLevelSchema = new Schema(
  {
    level: { type: Number, required: true },
    roles: { type: [String], default: [] },
    minAmount: { type: Number, default: 0 },
    maxAmount: { type: Number, default: Number.MAX_SAFE_INTEGER },
    minimumApprovals: { type: Number, default: 1 },
  },
  { _id: false }
);

const approvalPolicySchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
    hospitalId: { type: Schema.Types.ObjectId, ref: "Hospital", index: true },
    workflowType: { type: String, required: true, index: true },
    minimumApprovals: { type: Number, default: 1 },
    approvalLevels: { type: [approvalLevelSchema], default: [] },
    delegationAllowed: { type: Boolean, default: true },
    escalationHours: { type: Number, default: 24 },
    effectiveDate: { type: Date, default: Date.now },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
    metadata: { type: Object, default: {} },
  },
  { timestamps: true }
);

approvalPolicySchema.index({ hospitalId: 1, workflowType: 1, status: 1 });

export default model("ApprovalPolicy", approvalPolicySchema);
