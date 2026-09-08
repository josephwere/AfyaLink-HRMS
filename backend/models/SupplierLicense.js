import mongoose from "mongoose";

const { Schema } = mongoose;

const supplierLicenseSchema = new Schema({
  supplier: { type: Schema.Types.ObjectId, ref: "PharmacySupplier", required: true, index: true },
  licenseNumber: { type: String, required: true, unique: true, trim: true },
  authority: { type: String, default: "PPB" },
  status: { type: String, enum: ["ACTIVE", "SUSPENDED", "EXPIRED", "REVOKED"], default: "ACTIVE", index: true },
  expiresAt: Date,
  verifiedAt: Date,
  verifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

export default mongoose.models.SupplierLicense || mongoose.model("SupplierLicense", supplierLicenseSchema);
