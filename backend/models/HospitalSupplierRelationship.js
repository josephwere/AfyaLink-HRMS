import mongoose from "mongoose";

const { Schema } = mongoose;

const hospitalSupplierRelationshipSchema = new Schema({
  hospital: { type: Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
  supplier: { type: Schema.Types.ObjectId, ref: "PharmacySupplier", required: true, index: true },
  status: { type: String, enum: ["PENDING", "APPROVED", "SUSPENDED", "BLOCKED", "TERMINATED"], default: "PENDING", index: true },
  approvedAt: Date,
  approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
  paymentTerms: { type: String, default: "" },
  creditLimit: { type: Number, default: 0 },
  deliveryTerms: { type: String, default: "" },
  preferred: { type: Boolean, default: false },
  rating: { type: Number, default: 0, min: 0, max: 5 },
}, { timestamps: true });

hospitalSupplierRelationshipSchema.index({ hospital: 1, supplier: 1 }, { unique: true });

export default mongoose.models.HospitalSupplierRelationship || mongoose.model("HospitalSupplierRelationship", hospitalSupplierRelationshipSchema);
