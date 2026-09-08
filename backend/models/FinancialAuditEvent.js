import mongoose from "mongoose";
const { Schema, model } = mongoose;

const financialAuditEventSchema = new Schema({
  actor: { type: String, required: true },
  action: { type: String, required: true },
  entityType: { type: String, required: true },
  entityId: { type: String, required: true },
  metadata: { type: Object, default: {} },
  timestamp: { type: Date, default: Date.now },
  correlationId: { type: String, default: null },
  sourceService: { type: String, default: "finance" },
}, { timestamps: true });

export default model("FinancialAuditEvent", financialAuditEventSchema);
