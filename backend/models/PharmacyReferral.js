import mongoose from "mongoose";

const pharmacyReferralSchema = new mongoose.Schema(
  {
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
      index: true,
    },
    pharmacy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RegisteredPharmacy",
      required: true,
      index: true,
    },
    prescription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Prescription",
      index: true,
      default: null,
    },
    patientName: { type: String, trim: true, required: true },
    patientPhone: { type: String, trim: true, default: "" },
    patientUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      default: null,
    },
    patientRecord: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      index: true,
      default: null,
    },
    reason: { type: String, trim: true, default: "" },
    medicationNotes: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "FULFILLED", "CANCELLED"],
      default: "PENDING",
      index: true,
    },
    urgent: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

pharmacyReferralSchema.index({ hospital: 1, createdAt: -1 });
pharmacyReferralSchema.index({ pharmacy: 1, createdAt: -1 });
pharmacyReferralSchema.index({ pharmacy: 1, prescription: 1, createdAt: -1 });

export default mongoose.models.PharmacyReferral || mongoose.model("PharmacyReferral", pharmacyReferralSchema);
