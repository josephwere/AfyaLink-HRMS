import mongoose from "mongoose";

const { Schema, model } = mongoose;

const aiGatewayJobSchema = new Schema(
  {
    localJobId: { type: String, index: true, sparse: true },
    endpoint: { type: String, required: true, index: true },
    correlationId: { type: String, index: true },
    idempotencyKey: { type: String, index: true },
    requestHash: { type: String, index: true },

    actorId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    actorRole: { type: String, index: true },
    tenantId: { type: String, index: true },
    hospital: { type: Schema.Types.ObjectId, ref: "Hospital", index: true },

    neuroedgeJobId: { type: String, index: true, sparse: true },
    status: { type: String, index: true, default: "QUEUED" },
    outcome: { type: String, enum: ["SUCCESS", "FAILED"], default: "SUCCESS", index: true },
    errorCode: { type: String, default: null },
    errorMessage: { type: String, default: null },
    latencyMs: { type: Number, default: null },

    provenance: {
      model: { type: String, default: null },
      modelVersion: { type: String, default: null },
      promptHash: { type: String, default: null },
      evidenceIds: [{ type: String }],
      generatedAt: { type: Date, default: null },
      signature: { type: Schema.Types.Mixed, default: null },
    },
    responseSummary: { type: Schema.Types.Mixed, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

aiGatewayJobSchema.index({ tenantId: 1, hospital: 1, createdAt: -1 });
aiGatewayJobSchema.index({ endpoint: 1, status: 1, createdAt: -1 });
aiGatewayJobSchema.index({ neuroedgeJobId: 1, createdAt: -1 });
aiGatewayJobSchema.index({ localJobId: 1, createdAt: -1 });
aiGatewayJobSchema.index({ correlationId: 1, createdAt: -1 });
aiGatewayJobSchema.index({ idempotencyKey: 1, createdAt: -1 });
aiGatewayJobSchema.index(
  { endpoint: 1, actorId: 1, tenantId: 1, hospital: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $exists: true, $ne: null } },
    name: "uniq_async_job_idem_scope",
  }
);

export default mongoose.models.AIGatewayJob || model("AIGatewayJob", aiGatewayJobSchema);
