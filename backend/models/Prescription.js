import mongoose from "mongoose";

const PrescriptionSchema = new mongoose.Schema(
  {
    encounter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Encounter",
      index: true,
      default: null,
    },

    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      index: true,
      default: null,
    },

    patient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    patientRecord: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      index: true,
      default: null,
    },
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

    summary: {
      type: String,
      trim: true,
      default: "",
    },

    advice: {
      type: String,
      trim: true,
      default: "",
    },

    status: {
      type: String,
      enum: ["CREATED", "DISPENSED", "CANCELLED"],
      default: "CREATED",
      index: true,
    },

    dispensedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
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
