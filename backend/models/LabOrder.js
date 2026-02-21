import mongoose from "mongoose";

const LabOrderSchema = new mongoose.Schema(
  {
    encounter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Encounter",
      required: true,
      index: true,
    },

    patient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    hospital: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true },

    testName: { type: String, required: true },

    status: {
      type: String,
      enum: ["Pending", "Completed", "Cancelled"],
      default: "Pending",
      index: true,
    },

    result: String,
    completedAt: Date,
  },
  { timestamps: true }
);

/* 🔒 HARD GUARD */
LabOrderSchema.pre("save", function (next) {
  if (!this.$locals?.viaWorkflow) {
    return next(new Error("LabOrder must be created via workflow"));
  }
  next();
});

export default mongoose.model("LabOrder", LabOrderSchema);
