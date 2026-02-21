import mongoose from "mongoose";
const { Schema, model } = mongoose;

const planSchema = new Schema(
  {
    code: {
      type: String,
      enum: ["FREE", "BASIC", "PRO", "ENTERPRISE"],
      unique: true,
      required: true,
    },

    price: {
      monthly: { type: Number, default: 0 }, // KES or USD
      yearly: { type: Number, default: 0 },
      currency: { type: String, default: "KES" },
    },

    limits: {
      users: Number,
      patients: Number,
      storageMB: Number,
    },

    features: {
      ai: Boolean,
      payments: Boolean,
      pharmacy: Boolean,
      inventory: Boolean,
      lab: Boolean,
      realtime: Boolean,
      auditLogs: Boolean,
      adminCreation: Boolean,
    },

    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default model("Plan", planSchema);
