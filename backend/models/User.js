import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const { Schema, model } = mongoose;

/* ======================================================
   USER SCHEMA — RBAC + ABAC READY (FINAL)
====================================================== */
const userSchema = new Schema(
  {
    /* ---------------- BASIC IDENTITY ---------------- */
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    /* ---------------- ROLE (RBAC) ---------------- */
    role: {
      type: String,
      enum: [
        "SUPER_ADMIN",
        "HOSPITAL_ADMIN",
        "DOCTOR",
        "NURSE",
        "LAB_TECH",
        "PHARMACIST",
        "PATIENT",
        "GUEST",
      ],
      default: "PATIENT",
      required: true,
      index: true,
    },

    /* ---------------- EMAIL VERIFICATION ---------------- */
    emailVerified: {
      type: Boolean,
      default: false,
    },

    emailVerifiedAt: {
      type: Date,
    },

    /* ---------------- ACCOUNT STATE ---------------- */
    active: {
      type: Boolean,
      default: true,
    },

    /* ---------------- ABAC SCOPE ---------------- */
    hospitalId: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      index: true,
    },

    countryId: {
      type: String,
    },

    /* ---------------- PERMISSION OVERRIDES ---------------- */
    permissions: {
      type: [String],
      default: [],
    },

    /* ---------------- AUTH TOKENS ---------------- */
    refreshTokens: {
      type: [String],
      default: [],
      select: false,
    },

    /* ---------------- 2FA ---------------- */
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },

    /* ---------------- TRUSTED DEVICES ---------------- */
    trustedDevices: [
      {
        deviceId: { type: String, required: true },
        userAgent: String,
        lastUsed: { type: Date, default: Date.now },
        verifiedAt: Date,
        createdAt: { type: Date, default: Date.now },
      },
    ],

    /* ---------------- EXTENSIBILITY ---------------- */
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

/* ======================================================
   PASSWORD HASH
====================================================== */
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

/* ======================================================
   PASSWORD COMPARE
====================================================== */
userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

/* ======================================================
   MODEL EXPORT
====================================================== */
const User = mongoose.models.User || model("User", userSchema);
export default User;
