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

    /* ================= FEATURE TOGGLES ================= */
    features: {
      ai: { type: Boolean, default: false },
      payments: { type: Boolean, default: false },
      pharmacy: { type: Boolean, default: false },
      inventory: { type: Boolean, default: false },
      lab: { type: Boolean, default: false },
      realtime: { type: Boolean, default: false },
      auditLogs: { type: Boolean, default: false },
      adminCreation: { type: Boolean, default: false },
    },

    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Hospital", hospitalSchema);
