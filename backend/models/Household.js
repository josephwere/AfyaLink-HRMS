import mongoose from "mongoose";

const { Schema, model } = mongoose;

const householdSchema = new Schema(
  {
    hospital: { type: Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
    chw: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    householdId: { type: String, required: true, trim: true },
    headOfHousehold: { type: String, required: true, trim: true },
    phone: { type: String, default: "", trim: true },
    address: { type: String, default: "", trim: true },
    ward: { type: String, default: "", trim: true },
    memberCount: { type: Number, default: 0 },
    riskLevel: { type: String, enum: ["LOW", "MEDIUM", "HIGH"], default: "LOW" },
    lastVisitDate: { type: Date, default: null },
    nextVisitDate: { type: Date, default: null },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, versionKey: false }
);

householdSchema.index({ hospital: 1, chw: 1, createdAt: -1 });
householdSchema.index({ hospital: 1, householdId: 1 }, { unique: true });

export default mongoose.models.Household || model("Household", householdSchema);

