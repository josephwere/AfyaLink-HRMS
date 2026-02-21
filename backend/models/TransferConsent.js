import mongoose from "mongoose";

const { Schema, model } = mongoose;

const transferConsentSchema = new Schema(
  {
    transfer: { type: Schema.Types.ObjectId, ref: "Transfer", required: true, index: true },
    patient: { type: Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
    fromHospital: { type: Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
    toHospital: { type: Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
    status: {
      type: String,
      enum: ["PENDING", "GRANTED", "REVOKED", "EXPIRED"],
      default: "PENDING",
      index: true,
    },
    scopes: {
      type: [String],
      default: ["demographics", "encounters", "labs", "prescriptions"],
    },
    grantedBy: { type: Schema.Types.ObjectId, ref: "User" },
    revokedBy: { type: Schema.Types.ObjectId, ref: "User" },
    expiresAt: { type: Date, index: true },
    metadata: { type: Object, default: {} },
  },
  { timestamps: true }
);

transferConsentSchema.index({ transfer: 1, status: 1 });
transferConsentSchema.index({ patient: 1, fromHospital: 1, toHospital: 1, createdAt: -1 });

export default mongoose.models.TransferConsent ||
  model("TransferConsent", transferConsentSchema);
