import mongoose from "mongoose";

const { Schema } = mongoose;

const sourceRefSchema = new Schema({
  resource: { type: String, required: true },
  resourceId: { type: Schema.Types.Mixed, required: true },
  correlationId: { type: String, default: "" },
}, { _id: false });

const medicineSafetySignalSchema = new Schema({
  alertId: { type: Schema.Types.ObjectId, default: null, index: true },
  signalType: { type: String, required: true, index: true },
  origin: { type: String, enum: ["AI", "RULE", "REGULATORY"], required: true, index: true },
  severity: { type: String, enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"], required: true, index: true },
  status: { type: String, enum: ["OPEN", "ACKNOWLEDGED", "INVESTIGATING", "ACTION_REQUIRED", "RESOLVED"], default: "OPEN", index: true },
  score: { type: Number, default: 0, min: 0, max: 100 },
  confidence: { type: Number, default: 0, min: 0, max: 100 },
  explanation: { type: String, required: true },
  signals: { type: [String], default: [] },
  hospital: { type: Schema.Types.ObjectId, ref: "Hospital", default: null, index: true },
  itemId: { type: Schema.Types.ObjectId, ref: "PharmacyItem", default: null, index: true },
  batchNumber: { type: String, default: "", index: true },
  supplier: { type: Schema.Types.ObjectId, ref: "PharmacySupplier", default: null, index: true },
  regulatoryProduct: { type: Schema.Types.ObjectId, ref: "RegulatoryProduct", default: null },
  sourceRefs: { type: [sourceRefSchema], default: [] },
  evidenceIds: { type: [String], default: [] },
  correlationId: { type: String, required: true, index: true },
  detection: {
    ruleVersion: { type: String, default: "medicine-safety-v1" },
    detectedAt: { type: Date, default: Date.now },
    inputHash: { type: String, default: "" },
  },
  assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
  notes: { type: String, default: "" },
  resolution: { type: Schema.Types.Mixed, default: null },
  resolvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  resolvedAt: Date,
}, { timestamps: true });

medicineSafetySignalSchema.index({ signalType: 1, batchNumber: 1, supplier: 1, status: 1 });
medicineSafetySignalSchema.index({ "detection.inputHash": 1, status: 1 });

export default mongoose.models.MedicineSafetySignal || mongoose.model("MedicineSafetySignal", medicineSafetySignalSchema);
