import mongoose from "mongoose";
import { generatePharmacyId } from "../services/idGenerator.js";

const registeredPharmacySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    licenseNumber: { type: String, required: true, trim: true, unique: true, index: true },
    pharmacyId: { type: String, unique: true, immutable: true, sparse: true, index: true },
    governmentRegistryId: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: ["ACTIVE", "SUSPENDED", "CLOSED"],
      default: "ACTIVE",
      index: true,
    },
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      default: null,
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

registeredPharmacySchema.pre("save", async function (next) {
  if (!this.pharmacyId) {
    this.pharmacyId = await generatePharmacyId();
  }
  next();
});

registeredPharmacySchema.pre("findOneAndUpdate", async function (next) {
  const options = this.getOptions();
  if (!options.upsert) return next();

  const update = this.getUpdate() || {};
  const hasPharmacyId =
    update.pharmacyId !== undefined ||
    (update.$set && update.$set.pharmacyId !== undefined) ||
    (update.$setOnInsert && update.$setOnInsert.pharmacyId !== undefined);

  if (!hasPharmacyId) {
    const nextId = await generatePharmacyId();
    this.setUpdate({
      ...update,
      $setOnInsert: {
        ...(update.$setOnInsert || {}),
        pharmacyId: nextId,
      },
    });
  }

  next();
});

registeredPharmacySchema.index({ name: 1, createdAt: -1 });
registeredPharmacySchema.index({ "location.region": 1, "location.city": 1 });
registeredPharmacySchema.index({ "location.lat": 1, "location.lng": 1 });

export default mongoose.models.RegisteredPharmacy || mongoose.model("RegisteredPharmacy", registeredPharmacySchema);
