import mongoose from "mongoose";

const registeredPharmacySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    licenseNumber: { type: String, required: true, trim: true, unique: true, index: true },
    governmentRegistryId: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: ["ACTIVE", "SUSPENDED", "CLOSED"],
      default: "ACTIVE",
      index: true,
    },
    contact: {
      phone: { type: String, trim: true, default: "" },
      email: { type: String, trim: true, default: "" },
    },
    location: {
      country: { type: String, trim: true, default: "" },
      region: { type: String, trim: true, default: "" },
      city: { type: String, trim: true, default: "" },
      address: { type: String, trim: true, default: "" },
      lat: { type: Number, min: -90, max: 90, default: null },
      lng: { type: Number, min: -180, max: 180, default: null },
    },
    services: {
      type: [String],
      default: [],
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

registeredPharmacySchema.index({ name: 1, createdAt: -1 });
registeredPharmacySchema.index({ "location.region": 1, "location.city": 1 });
registeredPharmacySchema.index({ "location.lat": 1, "location.lng": 1 });

export default mongoose.models.RegisteredPharmacy || mongoose.model("RegisteredPharmacy", registeredPharmacySchema);
