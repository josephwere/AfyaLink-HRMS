import mongoose from "mongoose";

const hospitalLicenseSchema = new mongoose.Schema(
  {
    hospital: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
    country: { type: String, trim: true, uppercase: true, default: "" },
    authority: { type: String, trim: true, default: "MINISTRY_OF_HEALTH" },
    licenseNumber: { type: String, trim: true, default: "", index: true },
    status: {
      type: String,
      enum: ["PENDING", "ACTIVE", "SUSPENDED", "REVOKED", "EXPIRED"],
      default: "PENDING",
      index: true,
    },
    issuedAt: Date,
    expiresAt: Date,
    renewalDueAt: Date,
    lastInspectionAt: Date,
    complianceScore: { type: Number, default: 0 },
    notes: { type: String, trim: true, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

hospitalLicenseSchema.index({ country: 1, status: 1 });
hospitalLicenseSchema.index({ hospital: 1, status: 1, expiresAt: 1 });

export default mongoose.model("HospitalLicense", hospitalLicenseSchema);
