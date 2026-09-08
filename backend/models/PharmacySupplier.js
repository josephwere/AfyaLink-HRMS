import mongoose from "mongoose";

const { Schema } = mongoose;

const pharmacySupplierSchema = new Schema({
  name: { type: String, required: true, trim: true },
  legalName: { type: String, default: "", trim: true },
  contactName: { type: String, default: "", trim: true },
  email: { type: String, default: "", lowercase: true, trim: true },
  phone: { type: String, default: "", trim: true },
  hospitals: [{ type: Schema.Types.ObjectId, ref: "Hospital", index: true }],
  users: [{ type: Schema.Types.ObjectId, ref: "User" }],
  active: { type: Boolean, default: true, index: true },
  regulatoryStatus: { type: String, enum: ["PENDING", "ACTIVE", "SUSPENDED", "REVOKED"], default: "PENDING", index: true },
  trustScore: { type: Number, default: null, min: 0, max: 100 },
  regulatoryAuthority: { type: String, default: "PPB" },
  regulatoryReference: { type: String, default: "" },
  createdBy: { type: Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

pharmacySupplierSchema.index({ name: 1, active: 1 });

export default mongoose.models.PharmacySupplier || mongoose.model("PharmacySupplier", pharmacySupplierSchema);
