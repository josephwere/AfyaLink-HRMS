import mongoose from "mongoose";
const { Schema, model } = mongoose;

/* ======================================================
   ACCESS ENTRY — SINGLE SOURCE OF TRUTH
====================================================== */
const accessEntrySchema = new Schema(
  {
    /* ================= IDENTIFICATION ================= */
    code: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    hospital: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
      index: true,
    },

    /* ================= PERSON ================= */
    personType: {
      type: String,
      enum: [
        "VISITOR",
        "PATIENT",
        "STAFF",
        "CONTRACTOR",
        "VENDOR",
        "SECURITY",
        "SPECIAL",
      ],
      required: true,
      index: true,
    },

    personRef: {
      type: Schema.Types.ObjectId,
      refPath: "personModel",
    },

    personModel: {
      type: String,
      enum: ["User", "Patient", "Visitor"],
    },

    /* ================= PURPOSE ================= */
    purpose: {
      type: String,
      required: true,
      maxlength: 200,
    },

    /* ================= ACCESS CONTROL ================= */
    areasAllowed: [
      {
        type: Schema.Types.ObjectId,
        ref: "HospitalArea",
      },
    ],

    entryGate: String,
    exitGate: String,

    /* ================= TIME ================= */
    checkedInAt: Date,
    checkedOutAt: Date,

    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },

    /* ================= APPROVAL ================= */
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    verifiedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    /* ================= STATUS ================= */
    status: {
      type: String,
      enum: ["ACTIVE", "EXPIRED", "REVOKED"],
      default: "ACTIVE",
      index: true,
    },

    /* ================= SECURITY ================= */
    riskScore: {
      type: Number,
      default: 0,
      index: true,
    },

    violationsCount: {
      type: Number,
      default: 0,
    },

    /* ================= CONTEXT ================= */
    deviceUsed: String,
    ip: String,

    /* ================= METADATA ================= */
    metadata: {
      phone: String,
      idNumber: String,
      vehiclePlate: String,
      photoSnapshot: String,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

/* ======================================================
   INDEXES
====================================================== */
accessEntrySchema.index({ hospital: 1, createdAt: -1 });
accessEntrySchema.index({ status: 1, expiresAt: 1 });
accessEntrySchema.index({ hospital: 1, checkedOutAt: 1, checkedInAt: 1, expiresAt: 1, status: 1 });
accessEntrySchema.index({ hospital: 1, riskScore: -1, createdAt: -1 });

export default mongoose.models.AccessEntry ||
  model("AccessEntry", accessEntrySchema);
