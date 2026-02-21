import mongoose from "mongoose";

const { Schema, model } = mongoose;

const maternalRecordSchema = new Schema(
  {
    hospital: { type: Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
    chw: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    household: { type: Schema.Types.ObjectId, ref: "Household", default: null, index: true },
    motherName: { type: String, required: true, trim: true },
    trimester: { type: Number, min: 1, max: 3, default: 1 },
    ancVisits: { type: Number, default: 0 },
    expectedDeliveryDate: { type: Date, default: null },
    highRiskPregnancy: { type: Boolean, default: false },
    postnatalVisits: { type: Number, default: 0 },
    notes: { type: String, default: "", trim: true },
  },
  { timestamps: true, versionKey: false }
);

maternalRecordSchema.index({ hospital: 1, chw: 1, createdAt: -1 });

export default mongoose.models.MaternalRecord ||
  model("MaternalRecord", maternalRecordSchema);

