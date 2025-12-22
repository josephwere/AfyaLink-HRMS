import mongoose from "mongoose";

const hospitalSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    code: { type: String, unique: true },

    plan: {
      type: String,
      enum: ["FREE", "BASIC", "PRO", "ENTERPRISE"],
      default: "FREE",
    },

    limits: {
      users: Number,
      patients: Number,
      storageMB: Number,
    },

    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Hospital", hospitalSchema);
