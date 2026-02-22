import mongoose from "mongoose";

const { Schema, model } = mongoose;

const aiGatewayProvenanceSchema = new Schema(
  {
    jobRef: { type: Schema.Types.ObjectId, ref: "AIGatewayJob", index: true },
    correlationId: { type: String, index: true },
    endpoint: { type: String, index: true },
    tenantId: { type: String, index: true },
    hospital: { type: Schema.Types.ObjectId, ref: "Hospital", index: true },
    model: { type: String, index: true },
    modelVersion: { type: String, index: true },
    promptHash: { type: String, index: true },
    evidenceIds: [{ type: String }],
    generatedAt: { type: Date, default: null, index: true },
    signature: { type: Schema.Types.Mixed, default: null },
    keyId: { type: String, default: null },
    raw: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true, versionKey: false }
);

aiGatewayProvenanceSchema.index({ tenantId: 1, hospital: 1, createdAt: -1 });
aiGatewayProvenanceSchema.index({ correlationId: 1, createdAt: -1 });

export default mongoose.models.AIGatewayProvenance ||
  model("AIGatewayProvenance", aiGatewayProvenanceSchema);

