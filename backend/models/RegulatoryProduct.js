import mongoose from "mongoose";

const { Schema } = mongoose;

const regulatoryProductSchema = new Schema({
  registrationNumber: { type: String, required: true, unique: true, trim: true, index: true },
  tradeName: { type: String, required: true, trim: true },
  activeIngredient: { type: String, required: true, trim: true },
  dosageForm: { type: String, default: "" },
  strength: { type: String, default: "" },
  manufacturer: { type: String, required: true, trim: true },
  marketingAuthorizationHolder: { type: String, default: "" },
  countryOfOrigin: { type: String, default: "" },
  status: { type: String, enum: ["ACTIVE", "SUSPENDED", "RECALLED", "EXPIRED"], default: "ACTIVE", index: true },
  registrationExpiresAt: Date,
  authority: { type: String, default: "PPB" },
  sourceReference: { type: String, default: "" },
  updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

export default mongoose.models.RegulatoryProduct || mongoose.model("RegulatoryProduct", regulatoryProductSchema);
