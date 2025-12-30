import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const { Schema, model } = mongoose;

/* ======================================================
   USER SCHEMA — FINAL (STABLE + VERIFICATION FLOW READY)
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
      select: false, // IMPORTANT
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
      index: true,
    },

    /* ---------------- EMAIL VERIFICATION ---------------- */
    emailVerified: {
      type: Boolean,
      default: false,
    },

    emailVerifiedAt: Date,

    // ⬇️ NEW (NON-BREAKING)
    verificationDeadline: {
      type: Date,
      index: true,
    },

    verificationRemindersSent: {
      type: [String], // ["14d", "3d", "2h"]
      default: [],
      select: false,
    },

    /* ---------------- ACCOUNT STATE ---------------- */
    active: {
      type: Boolean,
      default: true,
    },

    /* ---------------- GOOGLE---------------- */
  googleId: {
  type: String,
  index: true,
},

authProvider: {
  type: String,
  enum: ["local", "google"],
  default: "local",
},

    /* ---------------- TOKENS ---------------- */
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
  },
  { timestamps: true }
);

/* ======================================================
   PASSWORD HASH (SINGLE SOURCE OF TRUTH)
====================================================== */
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  this.password = await bcrypt.hash(this.password, 10);
  next();
});

/* ======================================================
   PASSWORD COMPARE
====================================================== */
userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

/* ======================================================
   EXPORT
====================================================== */
const User = mongoose.models.User || model("User", userSchema);
export default User;
