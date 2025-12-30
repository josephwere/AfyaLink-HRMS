import mongoose from "mongoose";

const hospitalSchema = new mongoose.Schema(
  {
    /* ================= CORE ================= */
    name: { type: String, required: true },
    code: { type: String, unique: true, index: true },

    /* ================= PLAN ================= */
    plan: {
      type: String,
      enum: ["FREE", "BASIC", "PRO", "ENTERPRISE"],
      default: "FREE",
      index: true,
    },

    /* ================= LIMITS ================= */
    limits: {
      users: { type: Number, default: 5 },
      patients: { type: Number, default: 100 },
      storageMB: { type: Number, default: 512 },
    },

    /* ================= FEATURE TOGGLES ================= */
    features: {
      /* AI */
      ai: { type: Boolean, default: false },

      /* Finance */
      payments: { type: Boolean, default: false },

      /* Clinical */
      pharmacy: { type: Boolean, default: false },
      inventory: { type: Boolean, default: false },
      lab: { type: Boolean, default: false },

      /* Platform */
      realtime: { type: Boolean, default: false },
      auditLogs: { type: Boolean, default: false },
      adminCreation: { type: Boolean, default: false },
    },

    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

/* ======================================================
   🧠 HOSPITAL ONBOARDING DEFAULTS (PLAN-BASED)
====================================================== */
hospitalSchema.pre("save", function (next) {
  // Apply only on creation OR when plan changes
  if (!this.isNew && !this.isModified("plan")) return next();

  switch (this.plan) {
    case "FREE":
      this.features = {
        ai: false,
        payments: false,
        pharmacy: false,
        inventory: false,
        lab: false,
        realtime: false,
        auditLogs: false,
        adminCreation: false,
      };
      this.limits = {
        users: 5,
        patients: 100,
        storageMB: 512,
      };
      break;

    case "BASIC":
      this.features = {
        ai: true,
        payments: true,
        pharmacy: false,
        inventory: false,
        lab: true,
        realtime: false,
        auditLogs: true,
        adminCreation: false,
      };
      this.limits = {
        users: 20,
        patients: 1000,
        storageMB: 2048,
      };
      break;

    case "PRO":
      this.features = {
        ai: true,
        payments: true,
        pharmacy: true,
        inventory: true,
        lab: true,
        realtime: true,
        auditLogs: true,
        adminCreation: true,
      };
      this.limits = {
        users: 100,
        patients: 10000,
        storageMB: 10240,
      };
      break;

    case "ENTERPRISE":
      this.features = {
        ai: true,
        payments: true,
        pharmacy: true,
        inventory: true,
        lab: true,
        realtime: true,
        auditLogs: true,
        adminCreation: true,
      };
      this.limits = {
        users: 1000,
        patients: 100000,
        storageMB: 51200,
      };
      break;
  }

  next();
});

export default mongoose.model("Hospital", hospitalSchema);
