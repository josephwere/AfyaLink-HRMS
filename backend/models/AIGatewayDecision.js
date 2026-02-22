import mongoose from "mongoose";

const { Schema, model } = mongoose;

const aiGatewayDecisionSchema = new Schema(
  {
    correlationId: { type: String, index: true },
    endpoint: { type: String, index: true },
    action: { type: String, required: true, index: true },
    resource: {
      domain: { type: String, index: true },
      type: { type: String, index: true },
      id: { type: String, default: null },
      attributes: { type: Schema.Types.Mixed, default: null },
    },
    actorId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    actorRole: { type: String, index: true },
    tenantId: { type: String, index: true },
    hospital: { type: Schema.Types.ObjectId, ref: "Hospital", index: true },
    decision: { type: String, enum: ["ALLOW", "DENY"], required: true, index: true },
    reason: { type: String, default: null },
    obligations: [{ type: String }],
    maskedFields: [{ type: String }],
    policy: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true, versionKey: false }
);

aiGatewayDecisionSchema.index({ tenantId: 1, hospital: 1, createdAt: -1 });
aiGatewayDecisionSchema.index({ endpoint: 1, decision: 1, createdAt: -1 });

export default mongoose.models.AIGatewayDecision || model("AIGatewayDecision", aiGatewayDecisionSchema);

