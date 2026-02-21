import mongoose from "mongoose";

const { Schema, model } = mongoose;

const chronicPatientLogSchema = new Schema(
  {
    hospital: { type: Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
    chw: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    household: { type: Schema.Types.ObjectId, ref: "Household", default: null, index: true },
    patientName: { type: String, required: true, trim: true },
    condition: { type: String, required: true, trim: true },
    medicationCompliance: { type: String, enum: ["GOOD", "PARTIAL", "POOR"], default: "GOOD" },
    followUpDate: { type: Date, default: null },
    vitals: {
      bp: String,
      sugar: String,
      pulse: String,
    },
    escalationRequired: { type: Boolean, default: false },
    notes: { type: String, default: "", trim: true },
  },
  { timestamps: true, versionKey: false }
);

chronicPatientLogSchema.index({ hospital: 1, chw: 1, createdAt: -1 });

export default mongoose.models.ChronicPatientLog ||
  model("ChronicPatientLog", chronicPatientLogSchema);

