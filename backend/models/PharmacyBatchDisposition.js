import mongoose from "mongoose";

const { Schema } = mongoose;

const pharmacyBatchDispositionSchema = new Schema({
  hospital: { type: Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
  itemId: { type: Schema.Types.ObjectId, ref: "PharmacyItem", required: true },
  batchNumber: { type: String, required: true, trim: true, index: true },
  supplier: { type: Schema.Types.ObjectId, ref: "PharmacySupplier", default: null },
  destinationHospital: { type: Schema.Types.ObjectId, ref: "Hospital", default: null },
  disposition: { type: String, enum: ["RETURNED", "TRANSFERRED", "DESTROYED"], required: true, index: true },
  quantity: { type: Number, required: true, min: 1 },
  reason: { type: String, required: true },
  evidence: { type: Schema.Types.Mixed, default: {} },
  correlationId: { type: String, required: true, index: true },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

pharmacyBatchDispositionSchema.index({ hospital: 1, createdAt: -1 });

export default mongoose.models.PharmacyBatchDisposition || mongoose.model("PharmacyBatchDisposition", pharmacyBatchDispositionSchema);
