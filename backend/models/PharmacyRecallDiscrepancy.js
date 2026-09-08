import mongoose from "mongoose";

const { Schema } = mongoose;

const pharmacyRecallDiscrepancySchema = new Schema({
  recallId: { type: Schema.Types.ObjectId, ref: "PharmacyRecall", required: true, index: true },
  batchId: { type: String, default: "", index: true },
  hospital: { type: Schema.Types.ObjectId, ref: "Hospital", default: null, index: true },
  batchNumber: { type: String, default: "", trim: true, index: true },
  itemId: { type: Schema.Types.ObjectId, ref: "PharmacyItem", default: null, index: true },
  expectedQuantity: { type: Number, default: 0 },
  confirmedQuantity: { type: Number, default: null },
  received: { type: Number, default: 0 },
  held: { type: Number, default: 0 },
  dispensed: { type: Number, default: 0 },
  transferred: { type: Number, default: 0 },
  returned: { type: Number, default: 0 },
  destroyed: { type: Number, default: 0 },
  missingQuantity: { type: Number, default: 0 },
  overageQuantity: { type: Number, default: 0 },
  severity: { type: String, enum: ["NONE", "LOW", "MEDIUM", "HIGH", "CRITICAL"], default: "NONE" },
  status: { type: String, enum: ["OPEN", "INVESTIGATING", "RESOLVED"], default: "OPEN", index: true },
  reason: { type: String, default: "" },
  evidence: { type: Schema.Types.Mixed, default: {} },
  sourceRefs: { type: [Schema.Types.Mixed], default: [] },
  correlationId: { type: String, default: "", index: true },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  resolvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  resolvedAt: { type: Date, default: null },
}, { timestamps: true });

pharmacyRecallDiscrepancySchema.index({ recallId: 1, hospital: 1, batchNumber: 1, status: 1 });

export default mongoose.models.PharmacyRecallDiscrepancy || mongoose.model("PharmacyRecallDiscrepancy", pharmacyRecallDiscrepancySchema);
