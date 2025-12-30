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
