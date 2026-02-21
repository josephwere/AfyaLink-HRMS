import mongoose from "mongoose";

const { Schema, model } = mongoose;

const childGrowthRecordSchema = new Schema(
  {
    hospital: { type: Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
    chw: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    household: { type: Schema.Types.ObjectId, ref: "Household", default: null, index: true },
    childName: { type: String, required: true, trim: true },
    ageMonths: { type: Number, default: 0 },
    weightKg: { type: Number, default: 0 },
    heightCm: { type: Number, default: 0 },
    muacCm: { type: Number, default: 0 },
    nutritionRisk: { type: String, enum: ["LOW", "MEDIUM", "HIGH"], default: "LOW" },
    notes: { type: String, default: "", trim: true },
  },
  { timestamps: true, versionKey: false }
);

childGrowthRecordSchema.index({ hospital: 1, chw: 1, createdAt: -1 });

export default mongoose.models.ChildGrowthRecord ||
  model("ChildGrowthRecord", childGrowthRecordSchema);

