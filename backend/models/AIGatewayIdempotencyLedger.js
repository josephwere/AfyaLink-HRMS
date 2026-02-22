import mongoose from "mongoose";

const { Schema, model } = mongoose;

const aiGatewayIdempotencyLedgerSchema = new Schema(
  {
    endpoint: { type: String, required: true, index: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tenantId: { type: String, required: true, index: true },
    hospital: { type: Schema.Types.ObjectId, ref: "Hospital", index: true },
    idempotencyKey: { type: String, required: true, index: true },
    requestHash: { type: String, required: true },
    correlationId: { type: String, index: true },
    responseStatus: { type: Number, required: true },
    responseBody: { type: Schema.Types.Mixed, required: true },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true, versionKey: false }
);

aiGatewayIdempotencyLedgerSchema.index(
  { endpoint: 1, actorId: 1, tenantId: 1, hospital: 1, idempotencyKey: 1 },
  { unique: true, name: "idem_unique_route_actor_scope" }
);
aiGatewayIdempotencyLedgerSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.AIGatewayIdempotencyLedger ||
  model("AIGatewayIdempotencyLedger", aiGatewayIdempotencyLedgerSchema);

