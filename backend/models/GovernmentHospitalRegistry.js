import mongoose from "mongoose";

const governmentHospitalRegistrySchema = new mongoose.Schema(
  {
    officialName: { type: String, required: true, trim: true, index: true },
    aliases: { type: [String], default: [] },
    registrationNumber: { type: String, required: true, trim: true, unique: true, index: true },
    hospitalType: {
      type: String,
      enum: ["PRIVATE", "PUBLIC", "NGO"],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "SUSPENDED", "REVOKED", "EXPIRED"],
      default: "ACTIVE",
      index: true,
    },
    location: {
      country: { type: String, trim: true, default: "" },
      region: { type: String, trim: true, default: "" },
      city: { type: String, trim: true, default: "" },
      address: { type: String, trim: true, default: "" },
    },
    contact: {
      email: { type: String, trim: true, default: "" },
      phone: { type: String, trim: true, default: "" },
    },
    approvedAt: Date,
    validUntil: Date,
    source: {
      name: { type: String, trim: true, default: "Ministry of Health" },
      referenceUrl: { type: String, trim: true, default: "" },
    },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

governmentHospitalRegistrySchema.index({ officialName: "text", aliases: "text", registrationNumber: "text" });

export default mongoose.model("GovernmentHospitalRegistry", governmentHospitalRegistrySchema);
