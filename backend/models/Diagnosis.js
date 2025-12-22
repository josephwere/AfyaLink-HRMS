import mongoose from "mongoose";

const DiagnosisSchema = new mongoose.Schema(
  {
    encounter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Encounter",
      required: true,
      index: true,
    },

    patient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    hospital: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true },

    code: String, // ICD-10 optional
    description: { type: String, required: true },
  },
  { timestamps: true }
);

/* 🔒 HARD GUARD */
DiagnosisSchema.pre("save", function (next) {
  if (!this.$locals?.viaWorkflow) {
    return next(new Error("Diagnosis must be created via workflow"));
  }
  next();
});

export default mongoose.model("Diagnosis", DiagnosisSchema);
