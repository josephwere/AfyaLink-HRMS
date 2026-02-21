import mongoose from "mongoose";

const { Schema, model } = mongoose;

const householdMemberSchema = new Schema(
  {
    hospital: { type: Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
    household: { type: Schema.Types.ObjectId, ref: "Household", required: true, index: true },
    fullName: { type: String, required: true, trim: true },
    relationship: { type: String, default: "", trim: true },
    gender: { type: String, default: "", trim: true },
    dateOfBirth: { type: Date, default: null },
    nationalIdNumber: { type: String, default: "", trim: true },
    phone: { type: String, default: "", trim: true },
    chronicConditions: { type: [String], default: [] },
    isPregnant: { type: Boolean, default: false },
    immunizationStatus: { type: String, default: "UNKNOWN", trim: true },
  },
  { timestamps: true, versionKey: false }
);

householdMemberSchema.index({ hospital: 1, household: 1, fullName: 1 });

export default mongoose.models.HouseholdMember ||
  model("HouseholdMember", householdMemberSchema);

