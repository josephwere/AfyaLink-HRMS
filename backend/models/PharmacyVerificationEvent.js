import mongoose from "mongoose";

const { Schema } = mongoose;

const pharmacyVerificationEventSchema = new Schema({
  hospital: { type: Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
  itemId: { type: Schema.Types.ObjectId, ref: "PharmacyItem", required: true },
  batchNumber: { type: String, required: true, trim: true },
  supplier: { type: Schema.Types.ObjectId, ref: "PharmacySupplier", default: null },
  purchaseOrder: { type: Schema.Types.ObjectId, ref: "PharmacyPurchaseOrder", default: null },
  registrationNumber: { type: String, default: "" },
  scannedCode: { type: String, default: "" },
  scanMethod: { type: String, enum: ["CAMERA", "SCANNER", "MANUAL", "IMPORT"], default: "MANUAL" },
  evidenceSource: { type: String, enum: ["INTERNAL_REGISTRY", "PPB_API", "GOVERNMENT_IMPORT", "MANUAL_REGULATORY_DECISION"], default: "INTERNAL_REGISTRY" },
  evidenceHash: { type: String, default: "" },
  provider: { type: String, default: "INTERNAL_REGISTRY" },
  providerRequestId: { type: String, default: "" },
  providerResponseStatus: { type: String, default: "" },
  verificationTimestamp: { type: Date, default: null },
  evidenceVersion: { type: String, default: "v1" },
  correlationId: { type: String, required: true, index: true },
  result: { type: String, enum: ["VERIFIED", "QUARANTINED", "FAILED"], required: true, index: true },
  riskSignals: { type: [String], default: [] },
  evidence: { type: Schema.Types.Mixed, default: {} },
  scannedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  location: { type: String, default: "" },
}, { timestamps: true });

pharmacyVerificationEventSchema.index({ hospital: 1, createdAt: -1 });

export default mongoose.models.PharmacyVerificationEvent || mongoose.model("PharmacyVerificationEvent", pharmacyVerificationEventSchema);
