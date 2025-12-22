import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const { Schema, model } = mongoose;

/* ======================================================
   USER SCHEMA — RBAC + ABAC READY
====================================================== */
const userSchema = new Schema(
  {
    /* ---------------- BASIC IDENTITY ---------------- */
    name: { type: String, required: true },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },

    password: { type: String },

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
      required: true,
      index: true,
    },

    /* ---------------- ABAC SCOPE ---------------- */
    hospitalId: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      index: true,
    },

    countryId: { type: String },

    /* ---------------- PERMISSION OVERRIDES ---------------- */
    // Optional fine-grained permissions (enterprise use)
    permissions: {
      type: [String], // e.g. ["appointments.override", "records.read_all"]
      default: [],
    },

    /* ---------------- ACCOUNT STATE ---------------- */
    active: { type: Boolean, default: true },

    emailVerified: { type: Boolean, default: false },

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
        deviceId: { type: String, required: true }, // hashed
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

  if (this.password) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }

  next();
});

/* ======================================================
   PASSWORD COMPARE
====================================================== */
userSchema.methods.matchPassword = async function (entered) {
  if (!this.password) return false;
  return bcrypt.compare(entered, this.password);
};

/* ======================================================
   MODEL EXPORT
====================================================== */
const User = mongoose.models.User || model("User", userSchema);
export default User;
