// backend/models/User.js

import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const { Schema, model } = mongoose;

/* ======================================================
   USER SCHEMA
====================================================== */
const userSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      unique: true,
      lowercase: true,
      index: true,
      sparse: true,
    },

    phone: {
      type: String,
      unique: true,
      index: true,
      sparse: true,
    },

    password: {
      type: String,
      // ✅ only required for local auth users
      required: function () {
        return this.authProvider === "local";
      },
      select: false,
    },

    /* ======================================================
       🔐 ROLES (HAVSS + MEDICAL)
    ====================================================== */
    role: {
      type: String,
      enum: [
        "SUPER_ADMIN",
        "SYSTEM_ADMIN",
        "HOSPITAL_ADMIN",
        "DEVELOPER",
        "DOCTOR",
        "NURSE",
        "LAB_TECH",
        "PHARMACIST",
        "RADIOLOGIST",
        "THERAPIST",
        "RECEPTIONIST",
        "SECURITY_OFFICER",
        "SECURITY_ADMIN",
        "HR_MANAGER",
        "PAYROLL_OFFICER",
        "PATIENT",
        "GUEST",
      ],
      default: "PATIENT",
      index: true,
    },

    protectedAccount: {
      type: Boolean,
      default: false,
      index: true,
    },

    emailVerified: {
      type: Boolean,
      default: false,
    },

    emailVerifiedAt: Date,

    phoneVerified: {
      type: Boolean,
      default: false,
      index: true,
    },

    phoneVerifiedAt: Date,

    verificationDeadline: {
      type: Date,
      index: true,
    },

    verificationRemindersSent: {
      type: [String],
      default: [],
      select: false,
    },

    active: {
      type: Boolean,
      default: true,
    },

    /* =========================
       AUTH PROVIDERS
    ========================= */
    googleId: {
      type: String,
      index: true,
    },

    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },

    /* =========================
       TOKENS & SECURITY
    ========================= */
    refreshTokens: {
      type: [String],
      default: [],
    },

    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },

    trustedDevices: [
      {
        deviceId: { type: String, required: true },
        userAgent: String,
        lastIp: String,
        lastUsed: { type: Date, default: Date.now },
        verifiedAt: Date,
        createdAt: { type: Date, default: Date.now },
      },
    ],

    /* ======================================================
       🚨 BREAK-GLASS / EMERGENCY ACCESS
    ====================================================== */
    emergencyAccess: {
      active: { type: Boolean, default: false, index: true },
      reason: String,
      triggeredBy: { type: Schema.Types.ObjectId, ref: "User" },
      triggeredAt: Date,
      expiresAt: { type: Date, index: true },
      revokedAt: Date,
      revokedBy: { type: Schema.Types.ObjectId, ref: "User" },
    },

    /* =========================
       🏥 HOSPITAL TENANCY
    ========================= */
    hospital: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      index: true,
    },

    nationalIdNumber: {
      type: String,
      index: true,
    },

    nationalIdCountry: {
      type: String,
      index: true,
    },

    licenseNumber: {
      type: String,
      index: true,
    },

    licenseExpiry: {
      type: Date,
      index: true,
    },

    /* =========================
       PROFILE: BASIC
    ========================= */
    gender: {
      type: String,
      enum: ["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"],
    },
    dateOfBirth: Date,
    nationality: String,
    address: String,
    emergencyContact: {
      name: String,
      relationship: String,
      phone: String,
    },

    /* =========================
       PROFILE: EMPLOYMENT
    ========================= */
    employment: {
      employeeId: { type: String, index: true },
      department: String,
      reportingManager: String,
      employmentType: {
        type: String,
        enum: ["FULL_TIME", "LOCUM", "CONTRACT", "PART_TIME", "INTERN"],
      },
      hireDate: Date,
      contractStart: Date,
      contractEnd: Date,
      workLocation: String,
      branch: String,
    },

    /* =========================
       PROFILE: CREDENTIALS
    ========================= */
    credentials: {
      specialization: String,
      subSpecialization: String,
      certifications: { type: [String], default: [] },
      educationHistory: { type: [String], default: [] },
      documents: {
        type: [
          {
            name: String,
            url: String,
            uploadedAt: { type: Date, default: Date.now },
          },
        ],
        default: [],
      },
      cmeCredits: Number,
      researchPublications: Number,
      testAuthorizationLevel: String,
    },

    /* =========================
       PROFILE: FINANCIAL
    ========================= */
    financial: {
      bankName: String,
      bankAccountName: String,
      bankAccountNumber: String,
      bankBranch: String,
      taxId: String,
      pensionInfo: String,
      salaryStructure: String,
      allowances: { type: Number, default: 0 },
      deductions: { type: Number, default: 0 },
    },

    /* =========================
       PROFILE: SYSTEM
    ========================= */
    systemProfile: {
      status: {
        type: String,
        enum: ["ACTIVE", "SUSPENDED", "ON_LEAVE"],
        default: "ACTIVE",
      },
      accessExpiresAt: Date,
      lastActivityAt: Date,
    },

    sessionSecurity: {
      lastLoginAt: Date,
      lastLoginIp: String,
      lastLoginCountry: String,
      lastRiskScore: Number,
      lastRiskLevel: String,
      restrictedUntil: Date,
    },
  },
  { timestamps: true }
);

userSchema.index({ hospital: 1, active: 1, createdAt: -1 });
userSchema.index({ hospital: 1, role: 1, active: 1, createdAt: -1 });
userSchema.index({ "sessionSecurity.lastRiskLevel": 1, "sessionSecurity.lastLoginAt": -1 });

/* ======================================================
   🔐 AUTO-PROTECT SUPER_ADMIN
====================================================== */
userSchema.pre("save", function (next) {
  if (this.role === "SUPER_ADMIN") {
    this.protectedAccount = true;

    if (this.isModified("active") && this.active === false) {
      return next(new Error("SUPER_ADMIN account cannot be deactivated"));
    }
  }
  next();
});

/* ======================================================
   🚫 BLOCK SUPER_ADMIN DELETION
====================================================== */
async function preventSuperAdminDelete(next) {
  const user = await this.model.findOne(this.getQuery());
  if (user?.role === "SUPER_ADMIN" || user?.protectedAccount) {
    return next(new Error("SUPER_ADMIN accounts cannot be deleted"));
  }
  next();
}

userSchema.pre("deleteOne", { document: true, query: false }, function (next) {
  if (this.role === "SUPER_ADMIN") {
    return next(new Error("SUPER_ADMIN accounts cannot be deleted"));
  }
  next();
});

userSchema.pre("deleteOne", { document: false, query: true }, preventSuperAdminDelete);
userSchema.pre("findOneAndDelete", preventSuperAdminDelete);
userSchema.pre("findByIdAndDelete", preventSuperAdminDelete);

/* ======================================================
   🔑 PASSWORD HASH
====================================================== */
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  if (this.password) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

/* ======================================================
   🔍 PASSWORD COMPARE
====================================================== */
userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

/* ======================================================
   EXPORT
====================================================== */
const User = mongoose.models.User || model("User", userSchema);
export default User;
