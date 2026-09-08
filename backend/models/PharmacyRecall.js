import mongoose from "mongoose";

const { Schema } = mongoose;

const pharmacyRecallSchema = new Schema({
  registrationNumber: { type: String, default: "", index: true },
  regulatoryProduct: { type: Schema.Types.ObjectId, ref: "RegulatoryProduct", default: null },
  batchNumber: { type: String, default: "", index: true },
  status: { type: String, enum: ["DRAFT", "ACTIVE", "CONTAINMENT", "RECONCILIATION", "CLOSED", "OPEN", "UNDER_INVESTIGATION"], default: "DRAFT", index: true },
  severity: { type: String, enum: ["INFO", "WARNING", "CRITICAL"], default: "CRITICAL" },
  reason: { type: String, required: true },
  authority: { type: String, default: "PPB" },
  authorityReference: { type: String, default: "" },
  traceCompleteness: { type: Number, default: 0, min: 0, max: 100 },
  discrepancyCount: { type: Number, default: 0 },
  unresolvedDiscrepancies: { type: Number, default: 0 },
  reconciliationSummary: { type: Schema.Types.Mixed, default: {} },
  closureEvidence: { type: Schema.Types.Mixed, default: {} },
  hospitalAcknowledgements: { type: [Schema.Types.Mixed], default: [] },
  hospitalReconciliations: { type: [Schema.Types.Mixed], default: [] },
  quarantineConfirmations: { type: [Schema.Types.Mixed], default: [] },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  closedAt: Date,
  closedBy: { type: Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

pharmacyRecallSchema.index({ regulatoryProduct: 1, batchNumber: 1, status: 1 });

export default mongoose.models.PharmacyRecall || mongoose.model("PharmacyRecall", pharmacyRecallSchema);
