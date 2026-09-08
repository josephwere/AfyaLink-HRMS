import mongoose from "mongoose";

const { Schema } = mongoose;

const pharmacyBatchControlSchema = new Schema({
  hospital: { type: Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
  itemId: { type: Schema.Types.ObjectId, ref: "PharmacyItem", required: true, index: true },
  batchNumber: { type: String, required: true, trim: true, index: true },
  supplier: { type: Schema.Types.ObjectId, ref: "PharmacySupplier", default: null },
  regulatoryProduct: { type: Schema.Types.ObjectId, ref: "RegulatoryProduct", default: null },
  purchaseOrder: { type: Schema.Types.ObjectId, ref: "PharmacyPurchaseOrder", default: null },
  status: { type: String, enum: ["ACTIVE", "QUARANTINED", "RECALLED", "RELEASED"], default: "ACTIVE", index: true },
  verificationStatus: { type: String, enum: ["PENDING", "VERIFIED", "FAILED", "QUARANTINED"], default: "PENDING" },
  authenticityScore: { type: Number, default: null, min: 0, max: 100 },
  evidenceSource: { type: String, enum: ["INTERNAL_REGISTRY", "PPB_API", "GOVERNMENT_IMPORT", "MANUAL_REGULATORY_DECISION"], default: "INTERNAL_REGISTRY" },
  evidenceHash: { type: String, default: "" },
  reason: { type: String, default: "" },
  authorityReference: { type: String, default: "" },
  quarantinedAt: Date,
  releasedAt: Date,
  updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

pharmacyBatchControlSchema.index({ hospital: 1, itemId: 1, batchNumber: 1, createdAt: -1 });

export default mongoose.models.PharmacyBatchControl || mongoose.model("PharmacyBatchControl", pharmacyBatchControlSchema);
