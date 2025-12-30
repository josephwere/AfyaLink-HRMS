import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const { Schema, model } = mongoose;

/* ======================================================
   USER SCHEMA
====================================================== */
const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },

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

    protectedAccount: {
      type: Boolean,
      default: false,
      index: true,
    },

    emailVerified: { type: Boolean, default: false },
    emailVerifiedAt: Date,

    verificationDeadline: { type: Date, index: true },
    verificationRemindersSent: {
      type: [String],
      default: [],
      select: false,
    },

    active: { type: Boolean, default: true },

    googleId: { type: String, index: true },

    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },

    refreshTokens: {
      type: [String],
      default: [],
      select: false,
    },

    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },

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
   🔐 AUTO-PROTECT SUPER_ADMIN
====================================================== */
userSchema.pre("save", function (next) {
  if (this.role === "SUPER_ADMIN") {
    this.protectedAccount = true;

    if (this.isModified("active") && this.active === false) {
      return next(
        new Error("SUPER_ADMIN account cannot be deactivated")
      );
    }
  }
  next();
});

/* ======================================================
   🚫 BLOCK SUPER_ADMIN DELETION (ALL PATHS)
====================================================== */
async function preventSuperAdminDelete(next) {
  const user = await this.model.findOne(this.getQuery());
  if (user?.role === "SUPER_ADMIN" || user?.protectedAccount) {
    return next(
      new Error("SUPER_ADMIN accounts cannot be deleted")
    );
  }
  next();
}

userSchema.pre("deleteOne", { document: true, query: false }, function (next) {
  if (this.role === "SUPER_ADMIN") {
    return next(
      new Error("SUPER_ADMIN accounts cannot be deleted")
    );
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
