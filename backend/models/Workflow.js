import mongoose from "mongoose";

const workflowSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment" },

    state: { type: String, required: true },
    history: [
      {
        state: String,
        at: Date,
        by: mongoose.Schema.Types.ObjectId,
      },
    ],

    hospital: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital" },
    metadata: Object,
  },
  { timestamps: true }
);

export default mongoose.model("Workflow", workflowSchema);
