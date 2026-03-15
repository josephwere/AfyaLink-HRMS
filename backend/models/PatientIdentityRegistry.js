import mongoose from "mongoose";

const PatientIdentityRegistrySchema = new mongoose.Schema(
  {
    country: { type: String, trim: true, required: true, index: true },
    idType: { type: String, trim: true, default: "NATIONAL_ID", index: true },
    idNumber: { type: String, trim: true, required: true, index: true },
    firstName: { type: String, trim: true, default: "" },
    lastName: { type: String, trim: true, default: "" },
    dob: Date,
    gender: { type: String, trim: true, default: "" },
    status: { type: String, enum: ["ACTIVE", "SUSPENDED", "DECEASED"], default: "ACTIVE", index: true },
    verifiedAt: Date,
    source: { type: String, trim: true, default: "NATIONAL_REGISTRY" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

PatientIdentityRegistrySchema.index({ country: 1, idType: 1, idNumber: 1 }, { unique: true });

export default mongoose.model("PatientIdentityRegistry", PatientIdentityRegistrySchema);
