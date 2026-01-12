import mongoose from "mongoose";

const emergencyStateSchema = new mongoose.Schema(
  {
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
      unique: true,
    },
    active: {
      type: Boolean,
      default: false,
    },
    reason: {
      type: String,
    },
    activatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    activatedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

export default mongoose.model("EmergencyState", emergencyStateSchema);
