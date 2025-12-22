import mongoose from "mongoose";

const PrescriptionSchema = new mongoose.Schema(
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

    medications: [
      {
        name: String,
        dosage: String,
        frequency: String,
        duration: String,
      },
    ],

    status: {
      type: String,
      enum: ["Pending", "Dispensed", "Cancelled"],
      default: "Pending",
      index: true,
    },

    dispensedAt: Date,
  },
  { timestamps: true }
);

/* 🔒 HARD GUARD */
PrescriptionSchema.pre("save", function (next) {
  if (!this.$locals?.viaWorkflow) {
    return next(new Error("Prescription must be created via workflow"));
  }
  next();
});

export default mongoose.model("Prescription", PrescriptionSchema);
