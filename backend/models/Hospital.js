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

    /* ================= SOFT DELETE ================= */
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

/* ======================================================
   🧠 HOSPITAL ONBOARDING DEFAULTS (PLAN-BASED, SAFE)
   - Applies on creation
   - Applies on plan change
   - NEVER overwrites manual admin overrides
====================================================== */
hospitalSchema.pre("save", function (next) {
  if (!this.isNew && !this.isModified("plan")) return next();

  const planDefaults = {
    FREE: {
      features: {
        ai: false,
        payments: false,
        pharmacy: false,
        inventory: false,
        lab: false,
        realtime: false,
        auditLogs: false,
        adminCreation: false,
      },
      limits: {
        users: 5,
        patients: 100,
        storageMB: 512,
      },
    },

    BASIC: {
      features: {
        ai: true,
        payments: true,
        pharmacy: false,
        inventory: false,
        lab: true,
        realtime: false,
        auditLogs: true,
        adminCreation: false,
      },
      limits: {
        users: 20,
        patients: 1000,
        storageMB: 2048,
      },
    },

    PRO: {
      features: {
        ai: true,
        payments: true,
        pharmacy: true,
        inventory: true,
        lab: true,
        realtime: true,
        auditLogs: true,
        adminCreation: true,
      },
      limits: {
        users: 100,
        patients: 10000,
        storageMB: 10240,
      },
    },

    ENTERPRISE: {
      features: {
        ai: true,
        payments: true,
        pharmacy: true,
        inventory: true,
        lab: true,
        realtime: true,
        auditLogs: true,
        adminCreation: true,
      },
      limits: {
        users: 1000,
        patients: 100000,
        storageMB: 51200,
      },
    },
  };

  const defaults = planDefaults[this.plan];

  /* 🧠 MERGE — preserve admin overrides */
  this.features = {
    ...defaults.features,
    ...this.features,
  };

  this.limits = {
    ...defaults.limits,
    ...this.limits,
  };

  next();
});

export default mongoose.model("Hospital", hospitalSchema);
