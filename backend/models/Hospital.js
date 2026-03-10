import mongoose from "mongoose";

const hospitalSchema = new mongoose.Schema(
  {
    /* ================= CORE ================= */
    name: { type: String, required: true },
    code: { type: String, unique: true, index: true },
    address: { type: String, trim: true, default: "" },
    contact: { type: String, trim: true, default: "" },
    type: {
      type: String,
      enum: ["PRIVATE", "PUBLIC", "NGO"],
      default: "PRIVATE",
      index: true,
    },

    /* ================= PLAN ================= */
    plan: {
      type: String,
      enum: ["FREE", "BASIC", "PRO", "ENTERPRISE"],
      default: "FREE",
      index: true,
    },

    subscription: {
      paid: { type: Boolean, default: false, index: true },
      status: {
        type: String,
        enum: ["TRIAL", "ACTIVE", "PAST_DUE", "PAUSED"],
        default: "TRIAL",
        index: true,
      },
      trialStartedAt: { type: Date, default: Date.now },
      trialEndsAt: {
        type: Date,
        default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        index: true,
      },
      premiumPaused: { type: Boolean, default: false, index: true },
      lastPaymentAt: Date,
      nextBillingAt: Date,
      reminderTagsSent: {
        type: [String],
        default: [],
      },
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
      advertising: { type: Boolean, default: false },
      recruitmentAds: { type: Boolean, default: false },
      advancedAnalytics: { type: Boolean, default: false },
      heavyExports: { type: Boolean, default: false },
    },

    /* ================= ISO COMPLIANCE (NEW) ================= */
    isoCompliance: {
      enabled: { type: Boolean, default: false },
      auditLevel: {
        type: String,
        enum: ["STANDARD", "STRICT"],
        default: "STANDARD",
      },
      evidenceRetentionDays: {
        type: Number,
        default: 365, // 1 year
      },
      requireDualApprovalFor: {
        type: [String],
        default: ["EMERGENCY_ACCESS", "DATA_EXPORT"],
      },
    },

    /* ================= SOFT DELETE ================= */
    active: { type: Boolean, default: true },

    verification: {
      status: {
        type: String,
        enum: ["UNVERIFIED", "REVIEW_REQUIRED", "VERIFIED", "REJECTED", "EXPIRED"],
        default: "UNVERIFIED",
        index: true,
      },
      registryHospital: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "GovernmentHospitalRegistry",
        default: null,
      },
      registrationNumber: {
        type: String,
        trim: true,
        default: "",
        index: true,
      },
      approvalDate: Date,
      verifiedAt: Date,
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      expiresAt: Date,
      nextReverificationAt: Date,
      source: {
        type: String,
        trim: true,
        default: "GOVERNMENT_REGISTRY",
      },
      badgeLabel: {
        type: String,
        trim: true,
        default: "Government Approved",
      },
      publicVisible: { type: Boolean, default: false, index: true },
      lastRegistryCheckAt: Date,
      lastRegistryCheckResult: { type: String, trim: true, default: "" },
      suspiciousSignals: { type: [String], default: [] },
      reviewNotes: { type: String, trim: true, default: "" },
    },

    verificationDocuments: {
      registrationCertificate: {
        originalName: { type: String, trim: true, default: "" },
        mimeType: { type: String, trim: true, default: "" },
        sizeBytes: { type: Number, default: 0 },
        sha256: { type: String, trim: true, default: "" },
        storagePath: { type: String, trim: true, default: "" },
        uploadedAt: Date,
        validationStatus: {
          type: String,
          enum: ["MISSING", "AUTO_VALID", "REVIEW_REQUIRED"],
          default: "MISSING",
        },
      },
      taxRegistration: {
        originalName: { type: String, trim: true, default: "" },
        mimeType: { type: String, trim: true, default: "" },
        sizeBytes: { type: Number, default: 0 },
        sha256: { type: String, trim: true, default: "" },
        storagePath: { type: String, trim: true, default: "" },
        uploadedAt: Date,
        validationStatus: {
          type: String,
          enum: ["MISSING", "AUTO_VALID", "REVIEW_REQUIRED"],
          default: "MISSING",
        },
      },
      proofOfAddress: {
        originalName: { type: String, trim: true, default: "" },
        mimeType: { type: String, trim: true, default: "" },
        sizeBytes: { type: Number, default: 0 },
        sha256: { type: String, trim: true, default: "" },
        storagePath: { type: String, trim: true, default: "" },
        uploadedAt: Date,
        validationStatus: {
          type: String,
          enum: ["MISSING", "AUTO_VALID", "REVIEW_REQUIRED"],
          default: "MISSING",
        },
      },
      representativeId: {
        originalName: { type: String, trim: true, default: "" },
        mimeType: { type: String, trim: true, default: "" },
        sizeBytes: { type: Number, default: 0 },
        sha256: { type: String, trim: true, default: "" },
        storagePath: { type: String, trim: true, default: "" },
        uploadedAt: Date,
        validationStatus: {
          type: String,
          enum: ["MISSING", "AUTO_VALID", "REVIEW_REQUIRED"],
          default: "MISSING",
        },
      },
    },

    securityControls: {
      requireTwoFactorForAdmins: { type: Boolean, default: true },
      suspiciousRegistrationScore: { type: Number, default: 0 },
    },

    /* ================= LOCATION (PATIENT DISCOVERY) ================= */
    location: {
      country: { type: String, trim: true, default: "" },
      region: { type: String, trim: true, default: "" },
      city: { type: String, trim: true, default: "" },
      lat: { type: Number, min: -90, max: 90, default: null },
      lng: { type: Number, min: -180, max: 180, default: null },
    },

    /* ================= LINKED ADMINS ================= */
    admins: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    insuranceProviders: [
      {
        code: { type: String, trim: true }, // SHA, NHIF, PRIVATE_X
        name: { type: String, trim: true },
        country: { type: String, trim: true }, // KE, US, NG...
        enabled: { type: Boolean, default: true },
        metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
      },
    ],

    patientPaymentMethods: [
      {
        type: { type: String, trim: true }, // MPESA, BANK, CARD, STRIPE, FLUTTERWAVE
        label: { type: String, trim: true },
        accountName: { type: String, trim: true },
        accountNumber: { type: String, trim: true },
        paybill: { type: String, trim: true },
        tillNumber: { type: String, trim: true },
        phone: { type: String, trim: true },
        email: { type: String, trim: true },
        instructions: { type: String, trim: true },
        enabled: { type: Boolean, default: true },
      },
    ],

    customization: {
      enabled: { type: Boolean, default: false },
      branding: {
        appName: { type: String, trim: true, default: "" },
        tagline: { type: String, trim: true, default: "" },
        logo: { type: String, trim: true, default: "" },
        appIcon: { type: String, trim: true, default: "" },
        favicon: { type: String, trim: true, default: "" },
        loginBackground: { type: String, trim: true, default: "" },
        homeBackground: { type: String, trim: true, default: "" },
      },
      theme: {
        primaryColor: { type: String, trim: true, default: "" },
        accentColor: { type: String, trim: true, default: "" },
        sidebarStyle: {
          type: String,
          enum: ["DEFAULT", "COMPACT", "WIDE"],
          default: "DEFAULT",
        },
        topbarStyle: {
          type: String,
          enum: ["DEFAULT", "MINIMAL", "DENSE"],
          default: "DEFAULT",
        },
      },
      modules: {
        showAI: { type: Boolean, default: true },
        showReports: { type: Boolean, default: true },
        showAnalytics: { type: Boolean, default: true },
      },
      clinical: {
        closeoutPolicy: {
          enabled: { type: Boolean, default: false },
          requireDiagnosisBeforeClose: { type: Boolean, default: null },
          requireBillingHandoffWhenPaymentsEnabled: { type: Boolean, default: null },
          requirePrescriptionWhenPharmacyEnabled: { type: Boolean, default: null },
        },
      },
      machineAlerts: {
        autoEscalationHighMinutes: { type: Number, default: 15 },
        autoEscalationMediumMinutes: { type: Number, default: 60 },
        dedupCooldownMinutes: { type: Number, default: 10 },
        l1Roles: { type: [String], default: ["HOSPITAL_ADMIN", "DEVELOPER"] },
        l2Roles: { type: [String], default: ["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"] },
        onCallPrimaryUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        onCallSecondaryUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        requireReasonForHighSeverityActions: { type: Boolean, default: false },
      },
      updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      updatedAt: Date,
    },
  },
  { timestamps: true }
);

hospitalSchema.index({ active: 1, createdAt: -1 });
hospitalSchema.index({ name: 1 });
hospitalSchema.index({ "location.lat": 1, "location.lng": 1 });
hospitalSchema.index({ "verification.registrationNumber": 1 }, { unique: true, sparse: true });
hospitalSchema.index({ "verification.status": 1, active: 1, createdAt: -1 });

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
        advertising: false,
        recruitmentAds: false,
        advancedAnalytics: false,
        heavyExports: false,
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
        advertising: false,
        recruitmentAds: false,
        advancedAnalytics: false,
        heavyExports: false,
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
        advertising: true,
        recruitmentAds: true,
        advancedAnalytics: true,
        heavyExports: true,
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
        advertising: true,
        recruitmentAds: true,
        advancedAnalytics: true,
        heavyExports: true,
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

hospitalSchema.methods.getSubscriptionState = function getSubscriptionState(now = new Date()) {
  const trialEndsAt = this.subscription?.trialEndsAt;
  const status = this.subscription?.status || "TRIAL";
  const paid = status === "ACTIVE";
  const trialExpired = trialEndsAt ? now > trialEndsAt : false;
  const premiumPaused = Boolean(this.subscription?.premiumPaused) || (trialExpired && !paid);
  return {
    status,
    trialEndsAt,
    trialExpired,
    premiumPaused,
    daysLeft: trialEndsAt
      ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
      : 0,
  };
};

export default mongoose.model("Hospital", hospitalSchema);
