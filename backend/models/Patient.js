import mongoose from "mongoose";

const { Schema, model } = mongoose;

/* ======================================================
   PATIENT SCHEMA (SOFT-DELETE SAFE)
====================================================== */
const patientSchema = new Schema(
  {
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    dob: Date,
    gender: String,

    nationalId: { type: String, index: true },
    countryId: { type: String, index: true }, // Country-specific healthcare ID

    contact: String,
    address: String,

    /* ================= TENANCY ================= */
    hospital: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
      index: true,
    },

    primaryDoctor: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    medicalRecords: [
      {
        type: Schema.Types.ObjectId,
        ref: "Report",
      },
    ],

    insurance: {
      provider: String,
      policyNumber: String,
      metadata: Object,
    },

    identityVerification: {
      status: { type: String, enum: ["UNVERIFIED", "VERIFIED", "REJECTED"], default: "UNVERIFIED", index: true },
      method: { type: String, trim: true, default: "" }, // NATIONAL_ID, HEALTH_ID, BIOMETRIC
      registryMatch: { type: Boolean, default: false },
      lastCheckedAt: Date,
      verifiedAt: Date,
      immutable: { type: Boolean, default: false },
    },

    metadata: Object,

    /* ================= SOFT DELETE ================= */
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

patientSchema.index({ hospital: 1, active: 1, createdAt: -1 });
patientSchema.index({ hospital: 1, lastName: 1, firstName: 1 });
patientSchema.index({ hospital: 1, nationalId: 1 });

/* ======================================================
   🚫 NEVER RETURN DELETED PATIENTS BY DEFAULT (OPTIONAL)
   Enable later if you want global protection
====================================================== */
/*
patientSchema.pre(/^find/, function () {
  this.where({ active: { $ne: false } });
});
*/

export default model("Patient", patientSchema);
